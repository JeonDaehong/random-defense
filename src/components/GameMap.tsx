import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { GameState, Unit, Enemy, Boss, AttackEffect } from '../types/game';
import {
  MAP_COLS, MAP_ROWS, PATH_CELLS, INNER_MIN, INNER_MAX,
  GRADE_COLORS, ATTACK_TYPE_COLORS, ENEMY_TYPE_COLORS,
} from '../constants/gameConfig';

// 시드 기반 의사 난수 (장식물 배치용, 렌더 간 안정)
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function useMapDimensions() {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const maxMapHeight = Math.floor(screenH * 0.60);
  const availableWidth = screenW - 4;
  const cellSize = Math.min(Math.floor(availableWidth / MAP_COLS), Math.floor(maxMapHeight / MAP_ROWS));
  const mapWidth = cellSize * MAP_COLS;
  const mapHeight = cellSize * MAP_ROWS;
  return { cellSize, mapWidth, mapHeight };
}

// ===== 지형 그리드 (경로=도로, 안쪽=풀숲+장식) =====
const TerrainGrid = React.memo(function TerrainGrid({ cs }: { cs: number }) {
  const elements = useMemo(() => {
    const result: React.ReactElement[] = [];

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const isPath = PATH_CELLS.has(`${col},${row}`);
        const isInner = col >= INNER_MIN && col <= INNER_MAX && row >= INNER_MIN && row <= INNER_MAX;
        const seed = row * MAP_COLS + col;

        let bgColor: string;
        let borderColor: string;

        if (isPath) {
          const shade = seededRandom(seed * 3) > 0.5 ? '#3d3428' : '#362e22';
          bgColor = shade;
          borderColor = '#4a4030';
        } else if (isInner) {
          const grassVar = seededRandom(seed * 7);
          if (grassVar < 0.3) bgColor = '#1a3a1a';
          else if (grassVar < 0.6) bgColor = '#1e3e1c';
          else if (grassVar < 0.85) bgColor = '#1c3518';
          else bgColor = '#223d1e';
          borderColor = '#2a4a22';
        } else {
          bgColor = '#141420';
          borderColor = '#1a1a2a';
        }

        result.push(
          <View key={`t-${col}-${row}`} style={{
            position: 'absolute', left: col * cs, top: row * cs, width: cs, height: cs,
            backgroundColor: bgColor,
            borderWidth: 0.5, borderColor,
          }} />
        );

        // 도로 위 돌 무늬
        if (isPath && seededRandom(seed * 11) > 0.65) {
          const stoneSize = cs * (0.12 + seededRandom(seed * 13) * 0.1);
          const sx = seededRandom(seed * 17) * (cs - stoneSize);
          const sy = seededRandom(seed * 19) * (cs - stoneSize);
          result.push(
            <View key={`st-${col}-${row}`} style={{
              position: 'absolute',
              left: col * cs + sx, top: row * cs + sy,
              width: stoneSize, height: stoneSize * 0.7,
              borderRadius: stoneSize * 0.3,
              backgroundColor: '#544a3a',
              opacity: 0.4,
            }} />
          );
        }

        // 풀숲 장식물
        if (isInner) {
          const decorRoll = seededRandom(seed * 23);
          if (decorRoll < 0.08) {
            const treeSize = cs * 0.5;
            result.push(
              <View key={`tree-${col}-${row}`} style={{
                position: 'absolute',
                left: col * cs + cs * 0.25, top: row * cs + cs * 0.1,
                width: treeSize, height: treeSize,
                borderRadius: treeSize / 2,
                backgroundColor: '#2d5a1e',
                borderWidth: 1, borderColor: '#3a6e28',
                opacity: 0.7, zIndex: 1,
              }} />
            );
            result.push(
              <View key={`trunk-${col}-${row}`} style={{
                position: 'absolute',
                left: col * cs + cs * 0.44, top: row * cs + cs * 0.5,
                width: cs * 0.12, height: cs * 0.35,
                backgroundColor: '#5a3a1a',
                borderRadius: 1, opacity: 0.6, zIndex: 0,
              }} />
            );
          } else if (decorRoll < 0.18) {
            const rockW = cs * (0.2 + seededRandom(seed * 29) * 0.15);
            const rockH = rockW * 0.65;
            const rx = seededRandom(seed * 31) * (cs - rockW);
            const ry = seededRandom(seed * 37) * (cs - rockH);
            result.push(
              <View key={`rock-${col}-${row}`} style={{
                position: 'absolute',
                left: col * cs + rx, top: row * cs + ry,
                width: rockW, height: rockH,
                borderRadius: rockH * 0.4,
                backgroundColor: '#4a4a3a',
                borderWidth: 0.5, borderColor: '#5a5a48',
                opacity: 0.5, zIndex: 1,
              }} />
            );
          } else if (decorRoll < 0.33) {
            const gx = seededRandom(seed * 41) * cs * 0.6 + cs * 0.2;
            const gy = seededRandom(seed * 43) * cs * 0.6 + cs * 0.2;
            result.push(
              <View key={`grass-${col}-${row}`} style={{
                position: 'absolute',
                left: col * cs + gx - 2, top: row * cs + gy - 3,
                width: 4, height: 6,
                backgroundColor: '#3a6a2a',
                borderRadius: 2, opacity: 0.6, zIndex: 1,
              }} />
            );
          }
        }
      }
    }
    return result;
  }, [cs]);
  return <>{elements}</>;
});

// ===== 경로 테두리 하이라이트 =====
const PathBorder = React.memo(function PathBorder({ cs }: { cs: number }) {
  const lines = useMemo(() => {
    const result: React.ReactElement[] = [];
    result.push(
      <View key="start-marker" style={{
        position: 'absolute', left: -2, top: -2,
        width: cs + 4, height: cs + 4,
        borderRadius: 3, borderWidth: 1.5, borderColor: '#ff444488', zIndex: 2,
      }} />
    );
    return result;
  }, [cs]);
  return <>{lines}</>;
});

// ===== 아군 유닛 (자동 이동) =====
const UnitRenderer = React.memo(function UnitRenderer({ units, cs }: { units: Unit[]; cs: number }) {
  const unitSize = cs * 0.88;
  const unitOffset = (cs - unitSize) / 2;
  return <>
    {units.map(unit => {
      const typeSymbol = unit.attackType === 'penetrate' ? '➤' : unit.attackType === 'area' ? '✦' : '⚔';
      const accentColor = ATTACK_TYPE_COLORS[unit.attackType];
      const gradeColor = GRADE_COLORS[unit.grade];
      return (
        <View key={unit.id} style={{
          position: 'absolute',
          left: unit.x * cs + unitOffset,
          top: unit.y * cs + unitOffset,
          width: unitSize, height: unitSize,
          backgroundColor: accentColor + '30',
          borderColor: gradeColor,
          borderWidth: 1.5, borderRadius: unitSize * 0.22,
          alignItems: 'center', justifyContent: 'center', zIndex: 15,
        }}>
          <View style={{
            position: 'absolute', top: 1, left: 1, right: 1, bottom: 1,
            borderRadius: unitSize * 0.18, borderWidth: 0.5, borderColor: gradeColor + '40',
          }} />
          <Text style={{ color: gradeColor, fontSize: cs * 0.34, fontWeight: '900' }}>
            {typeSymbol}
          </Text>
          <View style={{
            position: 'absolute', top: -3, right: -3,
            backgroundColor: gradeColor, borderRadius: 5,
            paddingHorizontal: 3, minWidth: 12, alignItems: 'center',
            borderWidth: 1, borderColor: '#000',
          }}>
            <Text style={{ color: '#fff', fontSize: 7, fontWeight: '900' }}>{unit.grade}</Text>
          </View>
        </View>
      );
    })}
  </>;
});

// ===== 적 =====
const EnemyRenderer = React.memo(function EnemyRenderer({ enemies, cs }: { enemies: Enemy[]; cs: number }) {
  const enemySize = cs * 0.68;
  const bossSize = cs * 1.5;
  return <>
    {enemies.map(enemy => {
      const isBoss = 'isBoss' in enemy && (enemy as Boss).isBoss;
      const size = isBoss ? bossSize : enemySize;
      const hpPct = Math.max(0, enemy.currentHp / enemy.stats.hp * 100);
      const color = isBoss ? ENEMY_TYPE_COLORS.BOSS : ENEMY_TYPE_COLORS[enemy.type];
      return (
        <View key={enemy.id} style={{
          position: 'absolute',
          left: enemy.x * cs + (cs - size) / 2, top: enemy.y * cs + (cs - size) / 2,
          width: size, height: size,
          backgroundColor: color + '44', borderColor: color,
          borderWidth: isBoss ? 2.5 : 1.5, borderRadius: size / 2,
          alignItems: 'center', justifyContent: 'center', zIndex: 6,
        }}>
          {isBoss && (
            <View style={{
              position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
              borderRadius: (size + 6) / 2, borderWidth: 1, borderColor: color + '55',
            }} />
          )}
          <Text style={{ color: '#fff', fontSize: isBoss ? cs * 0.42 : cs * 0.26, fontWeight: '900' }}>
            {isBoss ? '👹' : enemy.type}
          </Text>
          <View style={[styles.hpBarBg, { width: size * 0.85, position: 'absolute', bottom: -4 }]}>
            <View style={[styles.hpBar, {
              width: `${hpPct}%`,
              backgroundColor: hpPct > 60 ? '#e74c3c' : hpPct > 30 ? '#f39c12' : '#cc2222',
            }]} />
          </View>
        </View>
      );
    })}
  </>;
});

// ===== 공격 이펙트 =====
const EffectRenderer = React.memo(function EffectRenderer({ effects, now, cs }: { effects: AttackEffect[]; now: number; cs: number }) {
  return <>
    {effects.map(fx => {
      const progress = Math.min(1, (now - fx.createdAt) / fx.duration);
      const opacity = 1 - progress;
      const scale = fx.scale ?? 1;
      const hexOpacity = (v: number) => Math.floor(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');

      if (fx.type === 'explosion') {
        const radius = cs * (0.5 + progress * 1.8) * scale;
        return (
          <View key={fx.id} style={{
            position: 'absolute',
            left: fx.fromX * cs + cs / 2 - radius / 2, top: fx.fromY * cs + cs / 2 - radius / 2,
            width: radius, height: radius,
            borderRadius: radius / 2,
            backgroundColor: fx.color + hexOpacity(opacity * 50),
            borderWidth: 2, borderColor: fx.color + hexOpacity(opacity * 180),
            zIndex: 20,
          }} />
        );
      }

      if (fx.type === 'shockwave') {
        const radius = cs * (0.3 + progress * 2.5) * scale;
        return (
          <View key={fx.id} style={{
            position: 'absolute',
            left: fx.fromX * cs + cs / 2 - radius / 2, top: fx.fromY * cs + cs / 2 - radius / 2,
            width: radius, height: radius,
            borderRadius: radius / 2,
            borderWidth: 2.5 * (1 - progress), borderColor: fx.color + hexOpacity(opacity * 200),
            zIndex: 21,
          }} />
        );
      }

      if (fx.type === 'arc') {
        const t = progress;
        const cx = fx.fromX + (fx.toX - fx.fromX) * t;
        const cy = fx.fromY + (fx.toY - fx.fromY) * t;
        const arcHeight = -3.0 * scale * t * (1 - t);
        const projSize = cs * 0.22 * scale;
        const trailOpacity = opacity * 0.8;
        return (
          <React.Fragment key={fx.id}>
            <View style={{
              position: 'absolute',
              left: cx * cs + cs / 2 - projSize * 0.4, top: cy * cs + cs / 2 - projSize * 0.15,
              width: projSize * 0.8, height: projSize * 0.3,
              borderRadius: projSize, backgroundColor: '#00000055', zIndex: 19,
            }} />
            <View style={{
              position: 'absolute',
              left: cx * cs + cs / 2 - projSize / 2,
              top: (cy + arcHeight) * cs + cs / 2 - projSize / 2,
              width: projSize, height: projSize,
              borderRadius: projSize / 2,
              backgroundColor: fx.color,
              borderWidth: 1.5, borderColor: '#fff8',
              opacity: trailOpacity, zIndex: 22,
            }} />
            {t > 0.15 && (
              <View style={{
                position: 'absolute',
                left: (cx - (fx.toX - fx.fromX) * 0.08) * cs + cs / 2 - projSize * 0.3,
                top: ((cy + arcHeight) + 0.1) * cs + cs / 2 - projSize * 0.3,
                width: projSize * 0.6, height: projSize * 0.6,
                borderRadius: projSize, backgroundColor: fx.color + '55',
                opacity: trailOpacity * 0.5, zIndex: 21,
              }} />
            )}
          </React.Fragment>
        );
      }

      if (fx.type === 'beam') {
        const dx = fx.toX - fx.fromX;
        const dy = fx.toY - fx.fromY;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const beamW = len * cs;
        const beamH = cs * 0.12 * scale;
        return (
          <View key={fx.id} style={{
            position: 'absolute',
            left: fx.fromX * cs + cs / 2, top: fx.fromY * cs + cs / 2 - beamH / 2,
            width: beamW, height: beamH,
            backgroundColor: fx.color + hexOpacity(opacity * 200),
            borderRadius: beamH / 2,
            transform: [{ rotate: `${angle}deg` }],
            transformOrigin: 'left center',
            opacity, zIndex: 20,
          }} />
        );
      }

      if (fx.type === 'spark') {
        const sparkSize = cs * 0.15 * scale;
        const spread = progress * cs * 0.6 * scale;
        return (
          <React.Fragment key={fx.id}>
            {[0, 60, 120, 180, 240, 300].map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const sx = fx.fromX * cs + cs / 2 + Math.cos(rad) * spread - sparkSize / 2;
              const sy = fx.fromY * cs + cs / 2 + Math.sin(rad) * spread - sparkSize / 2;
              return (
                <View key={`${fx.id}-s${i}`} style={{
                  position: 'absolute', left: sx, top: sy,
                  width: sparkSize, height: sparkSize,
                  borderRadius: sparkSize / 2,
                  backgroundColor: fx.color,
                  opacity: opacity * 0.9, zIndex: 22,
                }} />
              );
            })}
          </React.Fragment>
        );
      }

      if (fx.type === 'wave') {
        const radius = cs * (0.2 + progress * 1.6) * scale;
        return (
          <View key={fx.id} style={{
            position: 'absolute',
            left: fx.fromX * cs + cs / 2 - radius / 2, top: fx.fromY * cs + cs / 2 - radius / 2,
            width: radius, height: radius,
            borderRadius: radius / 2,
            borderWidth: 1.5 * (1 - progress * 0.5), borderColor: fx.color + hexOpacity(opacity * 160),
            backgroundColor: fx.color + hexOpacity(opacity * 25),
            zIndex: 20,
          }} />
        );
      }

      if (fx.type === 'bullet' || fx.type === 'slash') {
        const cx = fx.fromX + (fx.toX - fx.fromX) * progress;
        const cy = fx.fromY + (fx.toY - fx.fromY) * progress;
        const dotSize = (fx.type === 'slash' ? cs * 0.3 : cs * 0.18) * scale;
        return (
          <View key={fx.id} style={{
            position: 'absolute',
            left: cx * cs + cs / 2 - dotSize / 2, top: cy * cs + cs / 2 - dotSize / 2,
            width: dotSize, height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: fx.color,
            opacity, zIndex: 20,
          }} />
        );
      }

      if (fx.type === 'dmg_text' && fx.text) {
        const floatY = fx.fromY + (fx.toY - fx.fromY) * progress;
        const fontSize = cs * 0.32 * scale;
        return (
          <Text key={fx.id} style={{
            position: 'absolute',
            left: fx.fromX * cs + cs / 2 - cs, top: floatY * cs + cs / 2 - fontSize / 2,
            width: cs * 2,
            textAlign: 'center',
            color: fx.color,
            fontSize,
            fontWeight: '900',
            opacity,
            zIndex: 30,
            textShadowColor: '#000',
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 3,
          }}>
            {fx.text}
          </Text>
        );
      }

      if (fx.type === 'death_burst') {
        const burstScale = 0.5 + progress * 1.5;
        const radius = cs * burstScale * scale;
        return (
          <React.Fragment key={fx.id}>
            <View style={{
              position: 'absolute',
              left: fx.fromX * cs + cs / 2 - radius / 2, top: fx.fromY * cs + cs / 2 - radius / 2,
              width: radius, height: radius,
              borderRadius: radius / 2,
              backgroundColor: fx.color + hexOpacity(opacity * 80),
              borderWidth: 2 * (1 - progress),
              borderColor: '#fff' + hexOpacity(opacity * 200),
              zIndex: 25,
            }} />
            {[0, 72, 144, 216, 288].map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const dist = progress * cs * 0.8 * scale;
              const pSize = cs * 0.08 * scale * (1 - progress);
              return (
                <View key={`${fx.id}-d${i}`} style={{
                  position: 'absolute',
                  left: fx.fromX * cs + cs / 2 + Math.cos(rad) * dist - pSize / 2,
                  top: fx.fromY * cs + cs / 2 + Math.sin(rad) * dist - pSize / 2,
                  width: pSize, height: pSize,
                  borderRadius: pSize / 2,
                  backgroundColor: '#fff',
                  opacity: opacity * 0.8,
                  zIndex: 26,
                }} />
              );
            })}
          </React.Fragment>
        );
      }

      return null;
    })}
  </>;
});

interface Props {
  state: GameState;
}

export default function GameMap({ state }: Props) {
  const now = Date.now();
  const { cellSize, mapWidth, mapHeight } = useMapDimensions();

  return (
    <View style={[styles.map, { width: mapWidth, height: mapHeight }]}>
      <TerrainGrid cs={cellSize} />
      <PathBorder cs={cellSize} />
      <UnitRenderer units={state.units} cs={cellSize} />
      <EnemyRenderer enemies={state.enemies} cs={cellSize} />
      <EffectRenderer effects={state.effects} now={now} cs={cellSize} />
    </View>
  );
}

export { useMapDimensions };

const styles = StyleSheet.create({
  map: {
    position: 'relative',
    borderWidth: 2,
    borderColor: '#1a2a3a',
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  hpBarBg: {
    height: 3, backgroundColor: '#111', borderRadius: 2, overflow: 'hidden', marginTop: 2,
    borderWidth: 0.5, borderColor: '#333',
  },
  hpBar: {
    height: '100%', borderRadius: 2,
  },
});
