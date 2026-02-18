import { UnitGrade, UnitAttackType, Unit, Enemy, EnemyType, Magic, Boss, AttackEffect, BossAbility } from '../types/game';
import {
  GRADE_MULTIPLIER, GRADE_ASPD_MULTIPLIER, BASE_UNIT_STATS, SUMMON_GRADE_WEIGHTS,
  ENEMY_DAMAGE_MODIFIER, ALL_MAGICS, GRADE_UPGRADE_BONUS,
  ENEMY_BASE_HP, ENEMY_HP_GROWTH, ENEMY_TYPE_HP_MULT, ENEMY_TYPE_SPEED_MULT,
  BOSS_HP_MULTIPLIER,
  PATH_CELLS, INNER_MIN, INNER_MAX, ENEMY_PATH, SPAWN_PATH_INDICES,
} from '../constants/gameConfig';

let idCounter = 0;
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${idCounter++}`;
}

export function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

export function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 안쪽 영역에서 랜덤 위치 찾기 (경로 아닌 곳)
function findInnerPosition(): { x: number; y: number } {
  for (let attempt = 0; attempt < 100; attempt++) {
    const x = INNER_MIN + Math.floor(Math.random() * (INNER_MAX - INNER_MIN + 1));
    const y = INNER_MIN + Math.floor(Math.random() * (INNER_MAX - INNER_MIN + 1));
    if (!PATH_CELLS.has(`${x},${y}`)) {
      return { x, y };
    }
  }
  return { x: 5, y: 5 };
}

export function createUnit(attackType?: UnitAttackType, grade?: UnitGrade): Unit {
  const types: UnitAttackType[] = ['penetrate', 'area', 'single'];
  const type = attackType ?? randomFromArray(types);
  const g = grade ?? weightedRandom(SUMMON_GRADE_WEIGHTS).grade;
  const atkMult = GRADE_MULTIPLIER[g];
  const aspdMult = GRADE_ASPD_MULTIPLIER[g];
  const base = BASE_UNIT_STATS[type];
  const hp = Math.floor(base.hp * atkMult);
  return {
    id: generateId('unit'),
    attackType: type,
    grade: g,
    stats: {
      hp,
      attack: Math.floor(base.attack * atkMult),
      defense: 0,
      attackSpeed: Math.round(base.attackSpeed / aspdMult),
      range: base.range + (g === 'S' ? 0.5 : 0),
      moveSpeed: base.moveSpeed,
      penetrationCount: base.penetrationCount,
      areaRadius: base.areaRadius,
    },
    ...findInnerPosition(),
    currentHp: hp,
    targetId: null,
    lastAttackTime: 0,
  };
}

// 웨이브별 기본 이동속도 (20웨이브 이후 +0.01/wave, 35웨이브 이후 추가 +0.02/wave)
export function getBaseEnemySpeed(wave: number): number {
  let speed = 1.0;
  if (wave > 20) speed += (Math.min(wave, 35) - 20) * 0.01;
  if (wave > 35) speed += (wave - 35) * 0.02;
  return speed;
}

export function createEnemy(type: EnemyType, wave: number): Enemy {
  const hpBase = ENEMY_BASE_HP * Math.pow(ENEMY_HP_GROWTH, wave);
  const typedHp = Math.floor(hpBase * ENEMY_TYPE_HP_MULT[type]);
  const baseSpeed = getBaseEnemySpeed(wave);
  const typedSpeed = baseSpeed * ENEMY_TYPE_SPEED_MULT[type];

  const spawnIdx = randomFromArray(SPAWN_PATH_INDICES);
  const [startX, startY] = ENEMY_PATH[spawnIdx];
  const rx = (Math.random() - 0.5) * 0.3;
  const ry = (Math.random() - 0.5) * 0.3;

  return {
    id: generateId('enemy'),
    type,
    stats: { hp: typedHp, attack: 0, defense: 0, moveSpeed: typedSpeed },
    currentHp: typedHp,
    x: startX + rx,
    y: startY + ry,
    pathIndex: spawnIdx,
  };
}

export function createBoss(wave: number): Boss {
  const hpBase = ENEMY_BASE_HP * Math.pow(ENEMY_HP_GROWTH, wave);
  const bossHp = Math.floor(hpBase * BOSS_HP_MULTIPLIER);
  const baseSpeed = getBaseEnemySpeed(wave);

  let bossType: EnemyType;
  let speedMult: number;
  let ability: BossAbility;

  if (wave === 10)      { bossType = 'A'; speedMult = 1.6; ability = 'dash'; }
  else if (wave === 20) { bossType = 'B'; speedMult = 0.8; ability = 'shield'; }
  else if (wave === 30) { bossType = 'C'; speedMult = 1.2; ability = 'type_shift'; }
  else if (wave === 40) { bossType = 'B'; speedMult = 1.0; ability = 'enrage'; }
  else if (wave === 50) { bossType = 'A'; speedMult = 1.4; ability = 'phase_shift'; }
  else                  { bossType = 'D'; speedMult = 1.0; ability = 'dash'; }

  const spawnIdx = randomFromArray(SPAWN_PATH_INDICES);
  const [startX, startY] = ENEMY_PATH[spawnIdx];

  return {
    id: generateId('boss'),
    type: bossType,
    stats: { hp: bossHp, attack: 0, defense: 0, moveSpeed: baseSpeed * speedMult },
    currentHp: bossHp,
    x: startX, y: startY,
    pathIndex: spawnIdx,
    isBoss: true,
    bossAbility: ability,
    abilityTimer: 0,
    bossWave: wave,
    bossPhase: wave === 50 ? 1 : undefined,
    abilityActiveTimer: 0,
    damageReduction: 0,
  };
}

// 최종 피해 = (기본공격력 + 등급보너스×강화레벨) × 상성 배율
export function calculateDamage(unit: Unit, enemy: Enemy, upgradeLevel: number): number {
  const gradeBonus = GRADE_UPGRADE_BONUS[unit.grade] * upgradeLevel;
  const totalAtk = unit.stats.attack + gradeBonus;
  const modifier = ENEMY_DAMAGE_MODIFIER[enemy.type];
  const typeModifier = modifier[unit.attackType];
  const dmgMultiplier = typeof typeModifier === 'number' ? typeModifier : 1.0;
  // 보스 피해 감소 적용
  let dmg = Math.floor(totalAtk * dmgMultiplier);
  if ('isBoss' in enemy) {
    const boss = enemy as Boss;
    if (boss.damageReduction && boss.damageReduction > 0) {
      dmg = Math.floor(dmg * (1 - boss.damageReduction));
    }
  }
  return Math.max(1, dmg);
}

export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function createRandomMagic(): Magic {
  const template = randomFromArray(ALL_MAGICS);
  return { ...template, id: generateId('magic') };
}

export function getNextGrade(grade: UnitGrade): UnitGrade | null {
  const order: UnitGrade[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
  const idx = order.indexOf(grade);
  return idx >= order.length - 1 ? null : order[idx + 1];
}

export function getUpgradeCost(level: number): number {
  return 50 * Math.pow(2, level);
}

// A, B, C 타입만 등장 (D는 보스 전용)
export function getWaveEnemyTypes(_wave: number): EnemyType[] {
  return ['A', 'B', 'C'];
}

export function createEffect(
  fromX: number, fromY: number, toX: number, toY: number,
  color: string, type: AttackEffect['type'], duration = 300, scale = 1, text?: string
): AttackEffect {
  return {
    id: generateId('fx'),
    fromX, fromY, toX, toY,
    color, createdAt: Date.now(), duration, type, scale, text,
  };
}
