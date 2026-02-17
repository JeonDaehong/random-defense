import { GameState, Enemy, Unit, Boss, AttackEffect, UnitGrade } from '../types/game';
import {
  ENEMY_PATH, WAVE_SPAWN_INTERVAL, WAVE_SPAWN_COUNT, WAVE_REST_TIME, MAX_ENEMIES,
  INNER_MIN, INNER_MAX, GRADE_MULTIPLIER,
} from '../constants/gameConfig';
import {
  calculateDamage, getDistance, createEnemy, createBoss,
  getWaveEnemyTypes, randomFromArray, createEffect,
} from '../utils/helpers';

export type GameEvent =
  | { type: 'enemy_killed'; enemyId: string }
  | { type: 'game_over' }
  | { type: 'wave_clear'; wave: number }
  | { type: 'wave_start'; wave: number }
  | { type: 'boss_spawn' }
  | { type: 'unit_attack'; unitId: string; enemyId: string; damage: number };

// 등급별 이펙트 스케일
const GRADE_EFFECT_SCALE: Record<UnitGrade, number> = {
  F: 0.6, E: 0.8, D: 1.0, C: 1.3, B: 1.6, A: 2.0, S: 2.8,
};

export function gameTick(state: GameState, deltaTime: number, now: number): { newState: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let s = { ...state };

  if (s.phase === 'game_over' || s.phase === 'victory') return { newState: s, events };

  // === 이펙트 만료 제거 ===
  s = { ...s, effects: s.effects.filter(fx => now - fx.createdAt < fx.duration) };

  // === 웨이브 타이머 (prepare / wave_clear) ===
  if (s.phase === 'prepare' || s.phase === 'wave_clear') {
    s = { ...s, waveTimer: s.waveTimer - deltaTime };
    if (s.waveTimer <= 0) {
      s = startNextWave(s);
      events.push({ type: 'wave_start', wave: s.wave });
    }
  }

  // === battle 중 연속 스폰 (0.5초에 1마리) ===
  if (s.phase === 'battle' && s.spawnedCount < WAVE_SPAWN_COUNT) {
    s = { ...s, spawnTimer: s.spawnTimer - deltaTime };
    if (s.spawnTimer <= 0) {
      const enemyType = s.waveEnemyType ?? 'A';
      const newEnemy = createEnemy(enemyType, s.wave);
      s = {
        ...s,
        enemies: [...s.enemies, newEnemy],
        spawnTimer: WAVE_SPAWN_INTERVAL,
        spawnedCount: s.spawnedCount + 1,
      };
    }
  }

  // === 스폰 완료 → 웨이브 클리어 전환 ===
  if (s.phase === 'battle' && s.spawnedCount >= WAVE_SPAWN_COUNT) {
    s = { ...s, phase: 'wave_clear', waveTimer: WAVE_REST_TIME };
    events.push({ type: 'wave_clear', wave: s.wave });
  }

  // === 적 이동 (루프) ===
  s = { ...s, enemies: s.enemies.map(enemy => moveEnemy(enemy, s, deltaTime)) };

  // === 게임 오버 체크 (100마리 이상) ===
  if (s.enemies.length >= MAX_ENEMIES) {
    s = { ...s, phase: 'game_over' };
    events.push({ type: 'game_over' });
    return { newState: s, events };
  }

  // === 유닛 이동 + 공격 ===
  const unitResult = processUnitActions(s, deltaTime, now);
  s = { ...s, units: unitResult.units, enemies: unitResult.enemies, effects: [...s.effects, ...unitResult.newEffects] };
  events.push(...unitResult.events);

  // === 죽은 적 제거 + 사망 이펙트 ===
  const deathEffects: AttackEffect[] = [];
  for (const e of s.enemies) {
    if (e.currentHp <= 0) {
      events.push({ type: 'enemy_killed', enemyId: e.id });
      const isBoss = 'isBoss' in e;
      deathEffects.push(createEffect(e.x, e.y, e.x, e.y, isBoss ? '#FF0000' : '#FF8844', 'death_burst', isBoss ? 600 : 350, isBoss ? 2.5 : 1.0));
      deathEffects.push(createEffect(e.x, e.y, e.x, e.y - 1, '#FFD700', 'dmg_text', 800, 1.0, isBoss ? '+50G' : '+1G'));
    }
  }
  s = { ...s, enemies: s.enemies.filter(e => e.currentHp > 0), effects: [...s.effects, ...deathEffects] };

  return { newState: s, events };
}

function startNextWave(state: GameState): GameState {
  const nextWave = state.wave + 1;
  const isBossWave = nextWave % 10 === 0;
  const enemyTypes = getWaveEnemyTypes(nextWave);
  const chosenType = randomFromArray(enemyTypes);
  const newEnemies: Enemy[] = [];

  if (isBossWave) newEnemies.push(createBoss(nextWave));

  return {
    ...state,
    wave: nextWave,
    phase: 'battle',
    enemies: [...state.enemies, ...newEnemies],
    waveTimer: 0,
    spawnTimer: WAVE_SPAWN_INTERVAL,
    spawnedCount: 0,
    waveEnemyType: chosenType,
  };
}

function moveEnemy(enemy: Enemy, state: GameState, deltaTime: number): Enemy {
  const slowMult = state.commander?.ability === 'slow_aura' ? (1 - state.commander.abilityValue / 100) : 1;
  const speed = enemy.stats.moveSpeed * slowMult;
  const moveAmount = speed * (deltaTime / 1000);

  let { pathIndex, x, y } = enemy;
  const nextIdx = (pathIndex + 1) % ENEMY_PATH.length;
  const [targetX, targetY] = ENEMY_PATH[nextIdx];
  const dx = targetX - x;
  const dy = targetY - y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < moveAmount) {
    pathIndex = nextIdx; x = targetX; y = targetY;
  } else if (dist > 0) {
    x += (dx / dist) * moveAmount;
    y += (dy / dist) * moveAmount;
  }

  return { ...enemy, x, y, pathIndex };
}

// 안쪽 영역 클램프
function clampInner(val: number): number {
  return Math.max(INNER_MIN, Math.min(INNER_MAX, val));
}

// 겹침 체크 - 최소 거리 0.3 (거의 겹쳐도 OK, 완전 겹침만 방지)
const UNIT_MIN_DIST = 0.3;
function hasCollision(x: number, y: number, unitId: string, allUnits: Unit[]): boolean {
  for (const u of allUnits) {
    if (u.id === unitId) continue;
    if (getDistance(x, y, u.x, u.y) < UNIT_MIN_DIST) return true;
  }
  return false;
}

function processUnitActions(
  state: GameState, deltaTime: number, now: number,
): { units: Unit[]; enemies: Enemy[]; events: GameEvent[]; newEffects: AttackEffect[] } {
  const events: GameEvent[] = [];
  const newEffects: AttackEffect[] = [];
  let enemies = [...state.enemies];

  const units = state.units.map(unit => {
    if (enemies.length === 0) return unit;

    // 가장 가까운 적 찾기
    let closestEnemy: Enemy | null = null;
    let closestDist = Infinity;
    for (const enemy of enemies) {
      const dist = getDistance(unit.x, unit.y, enemy.x, enemy.y);
      if (dist < closestDist) { closestDist = dist; closestEnemy = enemy; }
    }
    if (!closestEnemy) return unit;

    let newX = unit.x;
    let newY = unit.y;

    // === 사거리 밖이면 이동 ===
    if (closestDist > unit.stats.range) {
      const speed = unit.stats.moveSpeed;
      const moveAmount = speed * (deltaTime / 1000);
      const dx = closestEnemy.x - unit.x;
      const dy = closestEnemy.y - unit.y;
      if (closestDist > 0) {
        const nx = dx / closestDist;
        const ny = dy / closestDist;
        newX = clampInner(unit.x + nx * moveAmount);
        newY = clampInner(unit.y + ny * moveAmount);
        // 직진 막히면 좌우 우회 시도
        if (hasCollision(newX, newY, unit.id, state.units)) {
          const perpX = -ny;
          const perpY = nx;
          const slide = (Math.random() > 0.5 ? 1 : -1);
          newX = clampInner(unit.x + (nx * 0.3 + perpX * slide * 0.7) * moveAmount);
          newY = clampInner(unit.y + (ny * 0.3 + perpY * slide * 0.7) * moveAmount);
          if (hasCollision(newX, newY, unit.id, state.units)) {
            newX = clampInner(unit.x + (nx * 0.3 - perpX * slide * 0.7) * moveAmount);
            newY = clampInner(unit.y + (ny * 0.3 - perpY * slide * 0.7) * moveAmount);
            if (hasCollision(newX, newY, unit.id, state.units)) {
              newX = unit.x;
              newY = unit.y;
            }
          }
        }
      }
      return { ...unit, x: newX, y: newY, targetId: closestEnemy.id };
    }

    // === 공격 쿨다운 체크 ===
    if (now - unit.lastAttackTime < unit.stats.attackSpeed) {
      return { ...unit, x: newX, y: newY };
    }

    const upgradeKey = `${unit.attackType}Attack` as 'penetrateAttack' | 'areaAttack' | 'singleAttack';
    const upgradeBonus = state.upgrades[upgradeKey];
    const berserkMult = state.commander?.ability === 'berserk' ? (1 + state.commander.abilityValue / 100) : 1;
    const critMult = (state.commander?.ability === 'crit_boost' && Math.random() * 100 < state.commander.abilityValue) ? 2.5 : 1;
    const scale = GRADE_EFFECT_SCALE[unit.grade];

    // 등급별 이펙트 색상 (고급 등급은 더 밝고 화려)
    const gradeHue = GRADE_MULTIPLIER[unit.grade];
    const baseColor = unit.attackType === 'single' ? '#8BC34A' : unit.attackType === 'area' ? '#FF5722' : '#00BCD4';
    const effectColor = gradeHue >= 5.0 ? '#FFD700' : gradeHue >= 3.5 ? '#FF6B35' : baseColor;

    // 데미지 텍스트 헬퍼
    const addDmgText = (x: number, y: number, dmg: number, crit: boolean) => {
      const rx = (Math.random() - 0.5) * 0.4;
      const color = crit ? '#FFD700' : dmg >= 50 ? '#FF4444' : '#ffffff';
      newEffects.push(createEffect(x + rx, y, x + rx, y - 1.2, color, 'dmg_text', 600, crit ? 1.4 : 1.0, `${dmg}`));
    };

    if (unit.attackType === 'area') {
      enemies = enemies.map(e => {
        if (getDistance(unit.x, unit.y, e.x, e.y) <= unit.stats.range) {
          const dmg = Math.floor(calculateDamage(unit, e, upgradeBonus) * berserkMult * critMult);
          events.push({ type: 'unit_attack', unitId: unit.id, enemyId: e.id, damage: dmg });
          addDmgText(e.x, e.y, dmg, critMult > 1);
          return { ...e, currentHp: e.currentHp - dmg };
        }
        return e;
      });
      newEffects.push(createEffect(unit.x, unit.y, closestEnemy.x, closestEnemy.y, effectColor, 'arc', 350, scale));
      newEffects.push(createEffect(closestEnemy.x, closestEnemy.y, closestEnemy.x, closestEnemy.y, effectColor, 'explosion', 300 + scale * 80, scale));
      if (gradeHue >= 3.5) {
        newEffects.push(createEffect(closestEnemy.x, closestEnemy.y, closestEnemy.x, closestEnemy.y, effectColor, 'shockwave', 400, scale * 1.5));
      }
    } else if (unit.attackType === 'penetrate') {
      const inRange = enemies
        .filter(e => getDistance(unit.x, unit.y, e.x, e.y) <= unit.stats.range)
        .sort((a, b) => getDistance(unit.x, unit.y, a.x, a.y) - getDistance(unit.x, unit.y, b.x, b.y))
        .slice(0, 3);
      const hitIds = new Set(inRange.map(e => e.id));
      enemies = enemies.map(e => {
        if (hitIds.has(e.id)) {
          const dmg = Math.floor(calculateDamage(unit, e, upgradeBonus) * berserkMult * critMult);
          events.push({ type: 'unit_attack', unitId: unit.id, enemyId: e.id, damage: dmg });
          addDmgText(e.x, e.y, dmg, critMult > 1);
          newEffects.push(createEffect(unit.x, unit.y, e.x, e.y, effectColor, 'beam', 250, scale));
          if (gradeHue >= 2.2) {
            newEffects.push(createEffect(e.x, e.y, e.x, e.y, '#ffffff', 'spark', 180, scale * 0.6));
          }
          return { ...e, currentHp: e.currentHp - dmg };
        }
        return e;
      });
    } else {
      const dmg = Math.floor(calculateDamage(unit, closestEnemy, upgradeBonus) * berserkMult * critMult);
      events.push({ type: 'unit_attack', unitId: unit.id, enemyId: closestEnemy.id, damage: dmg });
      addDmgText(closestEnemy.x, closestEnemy.y, dmg, critMult > 1);
      newEffects.push(createEffect(unit.x, unit.y, closestEnemy.x, closestEnemy.y, effectColor, 'slash', 200, scale));
      if (gradeHue >= 3.5) {
        newEffects.push(createEffect(closestEnemy.x, closestEnemy.y, closestEnemy.x, closestEnemy.y, effectColor, 'wave', 350, scale));
      }
      if (critMult > 1) {
        newEffects.push(createEffect(closestEnemy.x, closestEnemy.y, closestEnemy.x, closestEnemy.y, '#FFD700', 'spark', 250, 2.0));
      }
      enemies = enemies.map(e => e.id === closestEnemy!.id ? { ...e, currentHp: e.currentHp - dmg } : e);
    }

    return { ...unit, x: newX, y: newY, lastAttackTime: now, targetId: closestEnemy.id };
  });

  return { units, enemies, events, newEffects };
}
