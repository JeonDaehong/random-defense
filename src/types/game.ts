export type UnitAttackType = 'penetrate' | 'area' | 'single';
export type UnitGrade = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface UnitStats {
  hp: number;
  attack: number;
  defense: number;
  attackSpeed: number;
  range: number;
  moveSpeed: number;
}

export interface Unit {
  id: string;
  attackType: UnitAttackType;
  grade: UnitGrade;
  stats: UnitStats;
  x: number;
  y: number;
  currentHp: number;
  targetId: string | null;
  lastAttackTime: number;
}

export type EnemyType = 'A' | 'B' | 'C' | 'D';

export interface EnemyStats {
  hp: number;
  attack: number;
  defense: number;
  moveSpeed: number;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  stats: EnemyStats;
  currentHp: number;
  x: number;
  y: number;
  pathIndex: number;
}

export interface Gate {
  id: number;
  maxHp: number;
  currentHp: number;
  x: number;
  y: number;
  label: string;
}

export interface Nexus {
  maxHp: number;
  currentHp: number;
  x: number;
  y: number;
}

export interface AttackEffect {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  createdAt: number;
  duration: number;
  type: 'bullet' | 'slash' | 'explosion' | 'gate_hit' | 'wave' | 'beam' | 'shockwave' | 'spark' | 'arc' | 'dmg_text' | 'death_burst';
  scale?: number;
  text?: string;
}

export type MagicType = 'meteor' | 'freeze' | 'heal' | 'lightning' | 'barrier';
export interface Magic {
  id: string;
  type: MagicType;
  name: string;
  description: string;
  cooldown: number;
  damage?: number;
  duration?: number;
}

export type CommanderAbility = 'gold_boost' | 'berserk' | 'slow_aura' | 'shield' | 'crit_boost';
export interface Commander {
  id: string;
  name: string;
  description: string;
  ability: CommanderAbility;
  abilityValue: number;
  rarity: UnitGrade;
  icon: string;
}

export type BossAbility = 'regen' | 'summon' | 'aoe_attack' | 'shield' | 'speed_boost';
export interface Boss extends Enemy {
  isBoss: true;
  bossAbility: BossAbility;
  abilityTimer: number;
}

export interface WaveConfig {
  waveNumber: number;
  enemyCount: number;
  spawnInterval: number;
  spawnBatches: number;
  enemyTypes: EnemyType[];
  statMultiplier: number;
  isBossWave: boolean;
}

export interface Upgrades {
  penetrateAttack: number;
  areaAttack: number;
  singleAttack: number;
  goldBonus: number;
  gateHp: number;
}

export type GamePhase = 'prepare' | 'battle' | 'wave_clear' | 'game_over' | 'victory';

export interface GameState {
  gold: number;
  wave: number;
  phase: GamePhase;
  units: Unit[];
  enemies: Enemy[];
  gates: [Gate, Gate];
  nexus: Nexus;
  upgrades: Upgrades;
  magics: Magic[];
  commander: Commander | null;
  score: number;
  waveTimer: number;
  effects: AttackEffect[];
  spawnTimer: number;
  spawnedCount: number;
  waveEnemyType?: EnemyType;
}

export interface SaveData {
  commanders: Commander[];
  selectedCommanderId: string | null;
  highScore: number;
  totalGold: number;
}
