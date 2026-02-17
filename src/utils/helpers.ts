import { UnitGrade, UnitAttackType, Unit, Enemy, EnemyType, Magic, Boss, AttackEffect } from '../types/game';
import {
  GRADE_MULTIPLIER, BASE_UNIT_STATS, SUMMON_GRADE_WEIGHTS,
  ENEMY_DAMAGE_MODIFIER, ALL_MAGICS, BASE_ENEMY_STATS,
  WAVE_HP_SCALE, WAVE_ATK_SCALE, WAVE_DEF_SCALE,
  BOSS_HP_MULTIPLIER, BOSS_ATK_MULTIPLIER, BOSS_DEF_MULTIPLIER, BOSS_ABILITIES,
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
  return { x: 5, y: 5 }; // fallback center
}

export function createUnit(attackType?: UnitAttackType, grade?: UnitGrade): Unit {
  const types: UnitAttackType[] = ['penetrate', 'area', 'single'];
  const type = attackType ?? randomFromArray(types);
  const g = grade ?? weightedRandom(SUMMON_GRADE_WEIGHTS).grade;
  const mult = GRADE_MULTIPLIER[g];
  const base = BASE_UNIT_STATS[type];
  return {
    id: generateId('unit'),
    attackType: type,
    grade: g,
    stats: {
      hp: Math.floor(base.hp * mult),
      attack: Math.floor(base.attack * mult),
      defense: Math.floor(base.defense * mult),
      attackSpeed: Math.max(400, Math.floor(base.attackSpeed / (1 + (mult - 1) * 0.15))),
      range: base.range + (g === 'S' ? 1 : 0),
      moveSpeed: base.moveSpeed * (1 + (mult - 1) * 0.05),
    },
    ...findInnerPosition(),
    currentHp: Math.floor(base.hp * mult),
    targetId: null,
    lastAttackTime: 0,
  };
}

export function createEnemy(type: EnemyType, wave: number, _spawnOffset = 0): Enemy {
  const hpMult = 1 + wave * WAVE_HP_SCALE;
  const atkMult = 1 + wave * WAVE_ATK_SCALE;
  const defMult = 1 + wave * WAVE_DEF_SCALE;
  // 랜덤 스폰 포인트 (11시, 7시, 5시, 1시)
  const spawnIdx = randomFromArray(SPAWN_PATH_INDICES);
  const [startX, startY] = ENEMY_PATH[spawnIdx];
  const rx = (Math.random() - 0.5) * 0.3;
  const ry = (Math.random() - 0.5) * 0.3;

  return {
    id: generateId('enemy'),
    type,
    stats: {
      hp: Math.floor(BASE_ENEMY_STATS.hp * hpMult),
      attack: Math.floor(BASE_ENEMY_STATS.attack * atkMult),
      defense: Math.floor(BASE_ENEMY_STATS.defense * defMult),
      moveSpeed: BASE_ENEMY_STATS.moveSpeed,
    },
    currentHp: Math.floor(BASE_ENEMY_STATS.hp * hpMult),
    x: startX + rx,
    y: startY + ry,
    pathIndex: spawnIdx,
  };
}

export function createBoss(wave: number): Boss {
  const hpMult = (1 + wave * WAVE_HP_SCALE) * BOSS_HP_MULTIPLIER;
  const atkMult = (1 + wave * WAVE_ATK_SCALE) * BOSS_ATK_MULTIPLIER;
  const defMult = (1 + wave * WAVE_DEF_SCALE) * BOSS_DEF_MULTIPLIER;
  const [startX, startY] = ENEMY_PATH[0];

  return {
    id: generateId('boss'),
    type: 'D',
    stats: {
      hp: Math.floor(BASE_ENEMY_STATS.hp * hpMult),
      attack: Math.floor(BASE_ENEMY_STATS.attack * atkMult),
      defense: Math.floor(BASE_ENEMY_STATS.defense * defMult),
      moveSpeed: BASE_ENEMY_STATS.moveSpeed * 0.35,
    },
    currentHp: Math.floor(BASE_ENEMY_STATS.hp * hpMult),
    x: startX, y: startY,
    pathIndex: 0,
    isBoss: true,
    bossAbility: randomFromArray(BOSS_ABILITIES),
    abilityTimer: 0,
  };
}

export function calculateDamage(unit: Unit, enemy: Enemy, upgradeBonus: number): number {
  const baseDmg = unit.stats.attack + upgradeBonus;
  const modifier = ENEMY_DAMAGE_MODIFIER[enemy.type];
  const typeModifier = modifier[unit.attackType];
  if (typeModifier === 'immune') return 1;
  const dmgMultiplier = typeof typeModifier === 'number' ? typeModifier : 1.0;
  return Math.max(1, Math.floor(baseDmg * dmgMultiplier) - enemy.stats.defense);
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

export function getWaveEnemyTypes(wave: number): EnemyType[] {
  if (wave <= 2) return ['A', 'B'];
  if (wave <= 5) return ['A', 'B', 'C'];
  return ['A', 'B', 'C', 'D'];
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
