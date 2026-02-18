import { GameState, Enemy, Unit, Boss, AttackEffect, UnitGrade, EnemyType } from '../types/game';
import {
  ENEMY_PATH, WAVE_SPAWN_INTERVAL, WAVE_SPAWN_COUNT, WAVE_REST_TIME, MAX_ENEMIES,
  INNER_MIN, INNER_MAX, GRADE_MULTIPLIER, MAX_WAVE,
} from '../constants/gameConfig';
import {
  calculateDamage, getDistance, createEnemy, createBoss,
  getWaveEnemyTypes, randomFromArray, createEffect,
} from '../utils/helpers';

export type GameEvent =
  | { type: 'enemy_killed'; enemyId: string }
  | { type: 'game_over' }
  | { type: 'victory' }
  | { type: 'wave_clear'; wave: number }
  | { type: 'wave_start'; wave: number }
  | { type: 'boss_spawn' }
  | { type: 'unit_attack'; unitId: string; enemyId: string; damage: number };

// 등급별 이펙트 스케일
const GRADE_EFFECT_SCALE: Record<UnitGrade, number> = {
  F: 0.6, E: 0.8, D: 1.0, C: 1.3, B: 1.6, A: 2.0, S: 2.8,
};

// === 투사체 지연 데미지 시스템 ===
interface PendingHit {
  deliverAt: number;
  hits: { enemyId: string; damage: number }[];
  deferredEffects: AttackEffect[];
  events: GameEvent[];
}
let pendingHits: PendingHit[] = [];

export function resetPendingHits(): void {
  pendingHits = [];
}

export function gameTick(state: GameState, deltaTime: number, now: number): { newState: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let s = { ...state };

  if (s.phase === 'game_over' || s.phase === 'victory') return { newState: s, events };

  // === 이펙트 만료 제거 ===
  s = { ...s, effects: s.effects.filter(fx => now - fx.createdAt < fx.duration) };

  // === 지연 투사체 데미지 처리 ===
  const readyHits = pendingHits.filter(ph => now >= ph.deliverAt);
  pendingHits = pendingHits.filter(ph => now < ph.deliverAt);
  for (const ph of readyHits) {
    // 이펙트 createdAt을 현재 시간으로 갱신
    const fxs = ph.deferredEffects.map(fx => ({ ...fx, createdAt: now }));
    s = { ...s, effects: [...s.effects, ...fxs] };
    // 데미지 적용 (적이 아직 살아있는 경우에만)
    for (const hit of ph.hits) {
      s = { ...s, enemies: s.enemies.map(e =>
        e.id === hit.enemyId ? { ...e, currentHp: e.currentHp - hit.damage } : e
      ) };
    }
    events.push(...ph.events);
  }

  // === 웨이브 타이머 (prepare / wave_clear) ===
  if (s.phase === 'prepare' || s.phase === 'wave_clear') {
    s = { ...s, waveTimer: s.waveTimer - deltaTime };
    if (s.waveTimer <= 0) {
      // 50웨이브 클리어 시 승리
      if (s.wave >= MAX_WAVE) {
        s = { ...s, phase: 'victory' };
        events.push({ type: 'victory' });
        return { newState: s, events };
      }
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

  // === 보스 스킬 처리 ===
  s = { ...s, enemies: s.enemies.map(enemy => {
    if (!('isBoss' in enemy) || !(enemy as Boss).isBoss) return enemy;
    return processBossAbility(enemy as Boss, deltaTime);
  }) };

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

// ===== 보스 스킬 처리 =====
function processBossAbility(boss: Boss, deltaTime: number): Boss {
  let b = { ...boss, abilityTimer: boss.abilityTimer + deltaTime };

  // 활성 스킬 타이머 감소
  if (b.abilityActiveTimer && b.abilityActiveTimer > 0) {
    b.abilityActiveTimer -= deltaTime;
    if (b.abilityActiveTimer <= 0) {
      b.abilityActiveTimer = 0;
      b.damageReduction = 0; // 쉴드 만료
    }
  }

  switch (b.bossAbility) {
    case 'dash': // 10웨이브: 10초마다 순간 돌진 (경로 5칸 점프)
      if (b.abilityTimer >= 10000) {
        b.abilityTimer = 0;
        let idx = b.pathIndex;
        for (let i = 0; i < 5; i++) idx = (idx + 1) % ENEMY_PATH.length;
        const [nx, ny] = ENEMY_PATH[idx];
        return { ...b, pathIndex: idx, x: nx, y: ny };
      }
      break;

    case 'shield': // 20웨이브: 15초마다 받는 피해 50% 감소 5초
      if (b.abilityTimer >= 15000 && (!b.abilityActiveTimer || b.abilityActiveTimer <= 0)) {
        b.abilityTimer = 0;
        b.abilityActiveTimer = 5000;
        b.damageReduction = 0.5;
      }
      break;

    case 'type_shift': // 30웨이브: 20초마다 A/B/C 랜덤 상성 전환
      if (b.abilityTimer >= 20000) {
        b.abilityTimer = 0;
        const types: EnemyType[] = ['A', 'B', 'C'];
        b = { ...b, type: randomFromArray(types) };
      }
      break;

    case 'enrage': // 40웨이브: 체력 50% 이하 시 이동속도 50% 증가 + 점진 상승
      // 점진 상승: 매 초 +0.001
      if (b.abilityTimer >= 1000) {
        b.abilityTimer -= 1000;
        b = { ...b, stats: { ...b.stats, moveSpeed: b.stats.moveSpeed + 0.001 } };
      }
      // 50% 이하 한 번만 발동
      if (b.currentHp < b.stats.hp * 0.5 && !b.abilityActiveTimer) {
        b.abilityActiveTimer = 1; // 발동 플래그
        b = { ...b, stats: { ...b.stats, moveSpeed: b.stats.moveSpeed * 1.5 } };
      }
      break;

    case 'phase_shift': // 50웨이브: HP 기반 페이즈 전환
      if (b.bossPhase === 1 && b.currentHp < b.stats.hp * 0.66) {
        // 2페이즈: B형 초고체력 (이미 HP 그대로, 타입만 전환)
        b = { ...b, bossPhase: 2, type: 'B', stats: { ...b.stats, moveSpeed: b.stats.moveSpeed * 0.6 } };
      } else if (b.bossPhase === 2 && b.currentHp < b.stats.hp * 0.33) {
        // 3페이즈: C형 고속 + 상성 순환
        b = { ...b, bossPhase: 3, type: 'C', bossAbility: 'type_shift', abilityTimer: 0,
          stats: { ...b.stats, moveSpeed: b.stats.moveSpeed * 2.5 } };
      }
      break;
  }

  return b;
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

// 겹침 체크 - 최소 거리 0.3
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

    // 등급별 이펙트 색상
    const gradeHue = GRADE_MULTIPLIER[unit.grade];
    const baseColor = unit.attackType === 'single' ? '#8BC34A' : unit.attackType === 'area' ? '#FF5722' : '#00BCD4';
    const effectColor = gradeHue >= 3.0 ? '#FFD700' : gradeHue >= 1.9 ? '#FF6B35' : baseColor;

    // 데미지 텍스트 헬퍼
    const addDmgText = (x: number, y: number, dmg: number, crit: boolean) => {
      const rx = (Math.random() - 0.5) * 0.4;
      const color = crit ? '#FFD700' : dmg >= 50 ? '#FF4444' : '#ffffff';
      newEffects.push(createEffect(x + rx, y, x + rx, y - 1.2, color, 'dmg_text', 600, crit ? 1.4 : 1.0, `${dmg}`));
    };

    if (unit.attackType === 'area') {
      // 범위형: 투사체(arc) 발사 → 350ms 후 착탄 시 데미지
      const areaRadius = unit.stats.areaRadius ?? 1.5;
      const deferredHits: { enemyId: string; damage: number }[] = [];
      const deferredEffects: AttackEffect[] = [];
      const deferredEvents: GameEvent[] = [];
      for (const e of enemies) {
        if (getDistance(closestEnemy!.x, closestEnemy!.y, e.x, e.y) <= areaRadius) {
          const dmg = Math.floor(calculateDamage(unit, e, upgradeBonus) * berserkMult * critMult);
          deferredHits.push({ enemyId: e.id, damage: dmg });
          deferredEvents.push({ type: 'unit_attack', unitId: unit.id, enemyId: e.id, damage: dmg });
          // 데미지 텍스트도 착탄 시 표시
          const rx = (Math.random() - 0.5) * 0.4;
          const color = critMult > 1 ? '#FFD700' : dmg >= 50 ? '#FF4444' : '#ffffff';
          deferredEffects.push(createEffect(e.x + rx, e.y, e.x + rx, e.y - 1.2, color, 'dmg_text', 600, critMult > 1 ? 1.4 : 1.0, `${dmg}`));
        }
      }
      // 즉시: 포물선 투사체 이펙트
      newEffects.push(createEffect(unit.x, unit.y, closestEnemy.x, closestEnemy.y, effectColor, 'arc', 350, scale));
      // 착탄 시: 폭발 + 충격파
      deferredEffects.push(createEffect(closestEnemy.x, closestEnemy.y, closestEnemy.x, closestEnemy.y, effectColor, 'explosion', 300 + scale * 80, scale));
      if (gradeHue >= 1.9) {
        deferredEffects.push(createEffect(closestEnemy.x, closestEnemy.y, closestEnemy.x, closestEnemy.y, effectColor, 'shockwave', 400, scale * 1.5));
      }
      pendingHits.push({ deliverAt: now + 350, hits: deferredHits, deferredEffects, events: deferredEvents });
    } else if (unit.attackType === 'penetrate') {
      // 관통형: penetrationCount 만큼 다중 타격
      const maxTargets = unit.stats.penetrationCount ?? 2;
      const inRange = enemies
        .filter(e => getDistance(unit.x, unit.y, e.x, e.y) <= unit.stats.range)
        .sort((a, b) => getDistance(unit.x, unit.y, a.x, a.y) - getDistance(unit.x, unit.y, b.x, b.y))
        .slice(0, maxTargets);
      const hitIds = new Set(inRange.map(e => e.id));
      enemies = enemies.map(e => {
        if (hitIds.has(e.id)) {
          const dmg = Math.floor(calculateDamage(unit, e, upgradeBonus) * berserkMult * critMult);
          events.push({ type: 'unit_attack', unitId: unit.id, enemyId: e.id, damage: dmg });
          addDmgText(e.x, e.y, dmg, critMult > 1);
          newEffects.push(createEffect(unit.x, unit.y, e.x, e.y, effectColor, 'beam', 250, scale));
          if (gradeHue >= 1.5) {
            newEffects.push(createEffect(e.x, e.y, e.x, e.y, '#ffffff', 'spark', 180, scale * 0.6));
          }
          return { ...e, currentHp: e.currentHp - dmg };
        }
        return e;
      });
    } else {
      // 단일형: 참격(slash) 발사 → 200ms 후 데미지 (회피 불가)
      const dmg = Math.floor(calculateDamage(unit, closestEnemy, upgradeBonus) * berserkMult * critMult);
      const deferredHits = [{ enemyId: closestEnemy.id, damage: dmg }];
      const deferredEvents: GameEvent[] = [{ type: 'unit_attack', unitId: unit.id, enemyId: closestEnemy.id, damage: dmg }];
      const deferredEffects: AttackEffect[] = [];
      // 데미지 텍스트 착탄 시 표시
      const rx = (Math.random() - 0.5) * 0.4;
      const txtColor = critMult > 1 ? '#FFD700' : dmg >= 50 ? '#FF4444' : '#ffffff';
      deferredEffects.push(createEffect(closestEnemy.x + rx, closestEnemy.y, closestEnemy.x + rx, closestEnemy.y - 1.2, txtColor, 'dmg_text', 600, critMult > 1 ? 1.4 : 1.0, `${dmg}`));
      if (gradeHue >= 1.9) {
        deferredEffects.push(createEffect(closestEnemy.x, closestEnemy.y, closestEnemy.x, closestEnemy.y, effectColor, 'wave', 350, scale));
      }
      if (critMult > 1) {
        deferredEffects.push(createEffect(closestEnemy.x, closestEnemy.y, closestEnemy.x, closestEnemy.y, '#FFD700', 'spark', 250, 2.0));
      }
      // 즉시: 참격 이펙트
      newEffects.push(createEffect(unit.x, unit.y, closestEnemy.x, closestEnemy.y, effectColor, 'slash', 200, scale));
      pendingHits.push({ deliverAt: now + 200, hits: deferredHits, deferredEffects, events: deferredEvents });
    }

    return { ...unit, x: newX, y: newY, lastAttackTime: now, targetId: closestEnemy.id };
  });

  return { units, enemies, events, newEffects };
}
