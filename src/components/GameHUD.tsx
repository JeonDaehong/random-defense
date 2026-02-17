import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MAX_ENEMIES } from '../constants/gameConfig';

interface Props {
  gold: number;
  wave: number;
  phase: string;
  unitCount: number;
  enemyCount: number;
  waveTimer: number;
}

const phaseLabel: Record<string, string> = {
  prepare: '준비 중',
  battle: '전투',
  wave_clear: '클리어!',
  game_over: 'GAME OVER',
  victory: '승리!',
};

const phaseColor: Record<string, string> = {
  prepare: '#64B5F6',
  battle: '#ef5350',
  wave_clear: '#66BB6A',
  game_over: '#e94560',
  victory: '#FFD700',
};

function GameHUD({ gold, wave, phase, unitCount, enemyCount, waveTimer }: Props) {
  const timerSeconds = Math.ceil(waveTimer / 1000);
  const pColor = phaseColor[phase] ?? '#888';
  const enemyDanger = enemyCount >= 80;

  return (
    <View style={styles.container}>
      {/* 메인 바 */}
      <View style={styles.mainBar}>
        {/* 골드 */}
        <View style={styles.goldContainer}>
          <View style={styles.goldIconBg}>
            <Text style={styles.goldIconText}>G</Text>
          </View>
          <Text style={styles.goldValue}>{gold.toLocaleString()}</Text>
        </View>

        {/* 페이즈 + 타이머 */}
        <View style={[styles.phasePill, { borderColor: pColor + '60' }]}>
          <View style={[styles.phaseDot, { backgroundColor: pColor }]} />
          <Text style={[styles.phaseText, { color: pColor }]}>
            {phaseLabel[phase] ?? phase}
          </Text>
          {(phase === 'prepare' || phase === 'wave_clear') && timerSeconds > 0 && (
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>{timerSeconds}</Text>
            </View>
          )}
        </View>

        {/* 웨이브 */}
        <View style={styles.waveContainer}>
          <Text style={styles.waveLabel}>WAVE</Text>
          <Text style={styles.waveValue}>{wave}</Text>
        </View>
      </View>

      {/* 서브 정보 바 */}
      <View style={styles.subBar}>
        <View style={styles.statChip}>
          <View style={[styles.statDot, { backgroundColor: '#8BC34A' }]} />
          <Text style={styles.statText}>아군 {unitCount}</Text>
        </View>
        <View style={[styles.statChip, enemyDanger && styles.dangerChip]}>
          <View style={[styles.statDot, { backgroundColor: enemyDanger ? '#ff0000' : '#ef5350' }]} />
          <Text style={[styles.statText, enemyDanger && styles.dangerText]}>
            적 {enemyCount}/{MAX_ENEMIES}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default React.memo(GameHUD);

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 10,
  },
  mainBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0c1525',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1a2a40',
  },
  goldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goldIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#c8960020',
    borderWidth: 1.5,
    borderColor: '#c89600',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldIconText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '900',
  },
  goldValue: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0f1a',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    gap: 6,
  },
  phaseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  phaseText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timerBadge: {
    backgroundColor: '#FFD70020',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FFD70050',
  },
  timerText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '900',
  },
  waveContainer: {
    alignItems: 'center',
    minWidth: 48,
  },
  waveLabel: {
    color: '#556677',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 2,
  },
  waveValue: {
    color: '#e0e8f0',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 26,
  },
  subBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0f18',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
    borderWidth: 0.5,
    borderColor: '#1a2535',
  },
  dangerChip: {
    borderColor: '#ff000066',
    backgroundColor: '#1a0808',
  },
  dangerText: {
    color: '#ff4444',
    fontWeight: '900',
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statText: {
    color: '#778899',
    fontSize: 11,
    fontWeight: '700',
  },
});
