import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Commander } from '../src/types/game';
import { ALL_COMMANDERS, MAX_ENEMIES, ENEMY_KILL_GOLD, BOSS_KILL_GOLD, WAVE_CLEAR_GOLD } from '../src/constants/gameConfig';
import { useGameState } from '../src/hooks/useGameState';
import { gameTick } from '../src/engine/gameLoop';
import { updateHighScore } from '../src/store/storage';
import GameMap from '../src/components/GameMap';
import GameHUD from '../src/components/GameHUD';
import BottomPanel, { PanelAction } from '../src/components/BottomPanel';
import UpgradeModal from '../src/components/UpgradeModal';
import MagicModal from '../src/components/MagicModal';
import UnitsModal from '../src/components/UnitsModal';
import { SoundManager } from '../src/utils/sound';

export default function GameScreen() {
  const { commanderId } = useLocalSearchParams<{ commanderId: string }>();
  const commander = ALL_COMMANDERS.find(c => c.id === commanderId) ?? ALL_COMMANDERS[0];

  const {
    state, summonUnit, placeUnit, gamble, upgrade, sellUnit, mergeUnits,
    drawMagic, updateState, resetGame,
  } = useGameState(commander);

  const [activeModal, setActiveModal] = useState<PanelAction | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [waveBanner, setWaveBanner] = useState<string | null>(null);
  const [blink, setBlink] = useState(false);
  const lastTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 1500);
  }, []);

  // 사운드 초기화
  useEffect(() => {
    SoundManager.init();
    return () => { SoundManager.cleanup(); };
  }, []);

  // 위험 깜빡임
  const enemyDanger = state.enemies.length >= 80 && state.phase === 'battle';
  useEffect(() => {
    if (!enemyDanger) { setBlink(false); return; }
    const id = setInterval(() => setBlink(b => !b), 500);
    return () => clearInterval(id);
  }, [enemyDanger]);

  // requestAnimationFrame 기반 게임 루프
  useEffect(() => {
    updateState(prev => ({
      ...prev,
      phase: 'prepare',
      waveTimer: 5000,
    }));

    const tick = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const delta = Math.min(timestamp - lastTimeRef.current, 200);

      if (delta < 16) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      lastTimeRef.current = timestamp;

      updateState(prev => {
        if (prev.phase === 'game_over' || prev.phase === 'victory') return prev;

        const now = Date.now();
        const { newState, events } = gameTick(prev, delta, now);

        let goldEarned = 0;
        let scoreEarned = 0;
        let hasAttack = false;
        let hasKill = false;
        for (const ev of events) {
          if (ev.type === 'unit_attack') hasAttack = true;
          if (ev.type === 'enemy_killed') {
            hasKill = true;
            const enemy = prev.enemies.find(e => e.id === ev.enemyId);
            if (enemy) {
              const isBoss = 'isBoss' in enemy;
              goldEarned += isBoss ? BOSS_KILL_GOLD : ENEMY_KILL_GOLD;
              scoreEarned += isBoss ? 100 : 10;
            }
          }
        }
        // 효과음 (setState 내이지만 비동기라 안전)
        if (hasAttack) SoundManager.playAttack();
        if (hasKill) SoundManager.playExplosion();
        const waveStartEvt = events.find(e => e.type === 'wave_start');
        if (waveStartEvt) {
          SoundManager.playWaveStart();
          const w = (waveStartEvt as { wave: number }).wave;
          setWaveBanner(w % 10 === 0 ? `BOSS WAVE ${w}` : `WAVE ${w}`);
          setTimeout(() => setWaveBanner(null), 2000);
        }
        if (events.some(e => e.type === 'boss_spawn')) SoundManager.playBossSpawn();
        if (events.some(e => e.type === 'game_over')) { SoundManager.playGameOver(); SoundManager.stopBgm(); }
        if (events.some(e => e.type === 'victory')) { SoundManager.playWaveStart(); setWaveBanner('VICTORY!'); }

        const goldBonus = newState.commander?.ability === 'gold_boost'
          ? (1 + newState.commander.abilityValue / 100) : 1;
        const upgradeBonus = 1 + newState.upgrades.goldBonus * 0.1;

        let finalState = {
          ...newState,
          gold: newState.gold + Math.floor(goldEarned * goldBonus * upgradeBonus),
          score: newState.score + scoreEarned,
        };

        if (events.some(e => e.type === 'wave_clear')) {
          finalState = {
            ...finalState,
            gold: finalState.gold + Math.floor(WAVE_CLEAR_GOLD * goldBonus * upgradeBonus),
          };
        }

        return finalState;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateState]);

  useEffect(() => {
    if (state.phase === 'game_over') {
      updateHighScore(state.score);
    }
  }, [state.phase, state.score]);

  const handleAction = useCallback((action: PanelAction) => {
    switch (action) {
      case 'summon': {
        const unit = summonUnit();
        if (unit) {
          placeUnit(unit, unit.x, unit.y);
          SoundManager.playSummon();
          showNotification(`${unit.grade}등급 ${unit.attackType === 'penetrate' ? '관통' : unit.attackType === 'area' ? '범위' : '단일'}형 유닛 소환!`);
        } else {
          showNotification('골드가 부족합니다!');
        }
        break;
      }
      case 'gamble': {
        const result = gamble();
        if (result) {
          showNotification(`도박 결과: ${result.label}`);
        } else {
          showNotification('골드가 부족합니다!');
        }
        break;
      }
      case 'upgrade':
      case 'magic':
      case 'units':
        setActiveModal(action);
        break;
    }
  }, [summonUnit, placeUnit, gamble, showNotification]);

  const handleUseMagic = useCallback((magicId: string) => {
    updateState(prev => {
      const magic = prev.magics.find(m => m.id === magicId);
      if (!magic) return prev;

      let newState = { ...prev, magics: prev.magics.filter(m => m.id !== magicId) };

      switch (magic.type) {
        case 'meteor':
          newState = {
            ...newState,
            enemies: newState.enemies.map(e => ({
              ...e,
              currentHp: e.currentHp - (magic.damage ?? 200),
            })).filter(e => e.currentHp > 0),
          };
          showNotification('메테오 발동!');
          break;
        case 'lightning': {
          const shuffled = [...newState.enemies].sort(() => Math.random() - 0.5);
          const targets = new Set(shuffled.slice(0, 5).map(e => e.id));
          newState = {
            ...newState,
            enemies: newState.enemies.map(e =>
              targets.has(e.id) ? { ...e, currentHp: e.currentHp - (magic.damage ?? 300) } : e
            ).filter(e => e.currentHp > 0),
          };
          showNotification('번개 발동!');
          break;
        }
        case 'heal': {
          // 아군 유닛 체력 회복
          const healAmount = magic.damage ?? 150;
          newState = {
            ...newState,
            units: newState.units.map(u => ({
              ...u,
              currentHp: Math.min(u.stats.hp, u.currentHp + healAmount),
            })),
          };
          showNotification('치유 발동! 유닛 체력 회복');
          break;
        }
        case 'freeze':
          newState = {
            ...newState,
            enemies: newState.enemies.map(e => ({
              ...e,
              stats: { ...e.stats, moveSpeed: 0 },
            })),
          };
          setTimeout(() => {
            updateState(p => ({
              ...p,
              enemies: p.enemies.map(e => ({
                ...e,
                stats: { ...e.stats, moveSpeed: 0.8 },
              })),
            }));
          }, magic.duration ?? 3000);
          showNotification('빙결 발동!');
          break;
        case 'barrier':
          showNotification('배리어 발동!');
          break;
      }

      return newState;
    });
  }, [updateState, showNotification]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topSpacer} />

      <GameHUD
        gold={state.gold}
        wave={state.wave}
        phase={state.phase}
        unitCount={state.units.length}
        enemyCount={state.enemies.length}
        waveTimer={state.waveTimer}
      />

      {notification && (
        <View style={styles.notification}>
          <View style={styles.notifInner}>
            <Text style={styles.notificationText}>{notification}</Text>
          </View>
        </View>
      )}

      <View style={styles.mapArea}>
        {enemyDanger && (
          <View style={[styles.dangerBorder, { opacity: blink ? 0.7 : 0.2 }]} pointerEvents="none" />
        )}
        <GameMap state={state} />
        {waveBanner && (
          <View style={styles.waveBannerOverlay}>
            <Text style={[styles.waveBannerText, waveBanner.includes('BOSS') && styles.waveBannerBoss]}>
              {waveBanner}
            </Text>
          </View>
        )}
        {enemyDanger && (
          <View style={[styles.dangerTextWrap, { opacity: blink ? 1 : 0.3 }]} pointerEvents="none">
            <Text style={styles.dangerText}>{state.enemies.length}/{MAX_ENEMIES}</Text>
          </View>
        )}
      </View>

      <View style={styles.midSpacer} />

      {state.phase === 'victory' && (
        <View style={[styles.gameOverOverlay, { backgroundColor: 'rgba(0,20,60,0.9)' }]}>
          <Text style={[styles.gameOverTitle, { color: '#FFD700' }]}>VICTORY!</Text>
          <Text style={styles.gameOverScore}>점수: {state.score}</Text>
          <Text style={styles.gameOverWave}>50 웨이브 클리어!</Text>
          <View style={styles.gameOverButtons}>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: '#FFD700' }]} onPress={resetGame}>
              <Text style={[styles.retryBtnText, { color: '#000' }]}>다시하기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.back()}>
              <Text style={styles.homeBtnText}>메인으로</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {state.phase === 'game_over' && (
        <View style={styles.gameOverOverlay}>
          <Text style={styles.gameOverTitle}>GAME OVER</Text>
          <Text style={styles.gameOverScore}>점수: {state.score}</Text>
          <Text style={styles.gameOverWave}>웨이브: {state.wave}</Text>
          <View style={styles.gameOverButtons}>
            <TouchableOpacity style={styles.retryBtn} onPress={resetGame}>
              <Text style={styles.retryBtnText}>다시하기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.back()}>
              <Text style={styles.homeBtnText}>메인으로</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <BottomPanel gold={state.gold} onAction={handleAction} />

      <View style={styles.bottomSpacer} />

      <UpgradeModal
        visible={activeModal === 'upgrade'}
        onClose={() => setActiveModal(null)}
        upgrades={state.upgrades}
        gold={state.gold}
        onUpgrade={upgrade}
      />

      <MagicModal
        visible={activeModal === 'magic'}
        onClose={() => setActiveModal(null)}
        magics={state.magics}
        gold={state.gold}
        onDrawMagic={() => {
          const magic = drawMagic();
          if (magic) showNotification(`${magic.name} 마법 획득!`);
          else showNotification('골드가 부족합니다!');
        }}
        onUseMagic={handleUseMagic}
      />

      <UnitsModal
        visible={activeModal === 'units'}
        onClose={() => setActiveModal(null)}
        units={state.units}
        gold={state.gold}
        onSell={sellUnit}
        onMerge={mergeUnits}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060b18',
  },
  topSpacer: {
    height: 16,
  },
  mapArea: {
    alignItems: 'center',
    marginTop: 8,
    position: 'relative',
  },
  waveBannerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  waveBannerText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 6,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  waveBannerBoss: {
    color: '#FF2222',
    fontSize: 40,
  },
  midSpacer: {
    flex: 1,
    minHeight: 8,
  },
  bottomSpacer: {
    height: 20,
  },
  notification: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    zIndex: 100,
    alignItems: 'center',
  },
  notifInner: {
    backgroundColor: 'rgba(233, 69, 96, 0.92)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  notificationText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dangerBorder: {
    position: 'absolute',
    top: -2, left: -2, right: -2, bottom: -2,
    borderWidth: 3,
    borderColor: '#ff2222',
    borderRadius: 12,
    zIndex: 40,
  },
  dangerTextWrap: {
    position: 'absolute',
    top: 6, right: 8,
    backgroundColor: 'rgba(180, 0, 0, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 41,
  },
  dangerText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  gameOverTitle: {
    color: '#e94560',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 8,
  },
  gameOverScore: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  gameOverWave: {
    color: '#aaa',
    fontSize: 18,
    marginTop: 4,
  },
  gameOverButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 32,
  },
  retryBtn: {
    backgroundColor: '#e94560',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  homeBtn: {
    backgroundColor: '#0f3460',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  homeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
