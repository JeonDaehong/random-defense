import { UnitGrade, UnitAttackType, UnitStats, EnemyType, EnemyStats, Commander, Magic, BossAbility } from '../types/game';

// ===== 맵 설정 (정사각형) =====
export const MAP_SIZE = 12; // 12x12 grid
export const MAP_COLS = MAP_SIZE;
export const MAP_ROWS = MAP_SIZE;

// ===== 테두리 U자 경로 =====
// 11시(좌상단) → 7시(좌하단, 외성문) → 5시(우하단, 내성문) → 1시(우상단, 넥서스)
// 좌측 상단에서 시작, 좌측변 따라 내려감 → 하단변 따라 오른쪽 → 우측변 따라 올라감
export const ENEMY_PATH: [number, number][] = [];

// 좌측변 내려감 (col=0, row 0→11)
for (let r = 0; r < MAP_SIZE; r++) ENEMY_PATH.push([0, r]);
// 하단변 오른쪽 (row=11, col 1→11)
for (let c = 1; c < MAP_SIZE; c++) ENEMY_PATH.push([c, MAP_SIZE - 1]);
// 우측변 올라감 (col=11, row 10→0)
for (let r = MAP_SIZE - 2; r >= 0; r--) ENEMY_PATH.push([MAP_SIZE - 1, r]);
// 상단변 왼쪽 (row=0, col 10→1) — 1시→11시 연결
for (let c = MAP_SIZE - 2; c >= 1; c--) ENEMY_PATH.push([c, 0]);


// 스폰 포인트: 11시(0), 7시(11), 5시(22), 1시(33)
export const SPAWN_PATH_INDICES = [0, 11, 22, 33];

// 경로 셀 집합
export const PATH_CELLS = new Set<string>();
ENEMY_PATH.forEach(([x, y]) => PATH_CELLS.add(`${x},${y}`));

// 안쪽 영역 (아군 배치 가능 구역): row 1~10, col 1~10
export const INNER_MIN = 1;
export const INNER_MAX = MAP_SIZE - 2; // 10

// ===== 등급 =====
export const GRADE_MULTIPLIER: Record<UnitGrade, number> = {
  F: 1.0, E: 1.5, D: 2.2, C: 3.5, B: 5.0, A: 7.5, S: 12.0,
};
export const GRADE_SELL_PRICE: Record<UnitGrade, number> = {
  F: 30, E: 60, D: 120, C: 250, B: 500, A: 1000, S: 2500,
};
export const MERGE_COST: Record<UnitGrade, number> = {
  F: 50, E: 100, D: 200, C: 400, B: 800, A: 1600, S: 0,
};

// ===== 유닛 스탯 =====
export const BASE_UNIT_STATS: Record<UnitAttackType, UnitStats> = {
  single: { hp: 120, attack: 25, defense: 5, attackSpeed: 800, range: 2.5, moveSpeed: 3.0 },
  area: { hp: 90, attack: 12, defense: 3, attackSpeed: 1200, range: 3, moveSpeed: 2.2 },
  penetrate: { hp: 100, attack: 18, defense: 4, attackSpeed: 1000, range: 3.5, moveSpeed: 2.5 },
};

// ===== 적 상성 (A,B,C,D만) =====
// A: 관통에 강(150%), 단일에 약(50%)
// B: 범위에 강(150%), 관통에 약(50%)
// C: 단일에 강(150%), 범위에 약(50%)
// D: 일반 (상성 없음)
export const ENEMY_DAMAGE_MODIFIER: Record<EnemyType, Partial<Record<UnitAttackType, number | 'immune'>>> = {
  A: { penetrate: 1.5, single: 0.5 },
  B: { area: 1.5, penetrate: 0.5 },
  C: { single: 1.5, area: 0.5 },
  D: {},
};

export const BASE_ENEMY_STATS: EnemyStats = { hp: 70, attack: 4, defense: 1, moveSpeed: 1.6 };

// ===== 웨이브 =====
export const WAVE_SPAWN_INTERVAL = 500;       // 0.5초에 한 마리
export const WAVE_SPAWN_DURATION = 70000;     // 70초 동안 스폰
export const WAVE_SPAWN_COUNT = Math.floor(WAVE_SPAWN_DURATION / WAVE_SPAWN_INTERVAL); // 140마리
export const WAVE_REST_TIME = 20000;          // 20초 휴식
export const WAVE_HP_SCALE = 0.28;
export const WAVE_ATK_SCALE = 0.05;
export const WAVE_DEF_SCALE = 0.08;
export const MAX_ENEMIES = 100;

// ===== 보스 =====
export const BOSS_HP_MULTIPLIER = 100;
export const BOSS_ATK_MULTIPLIER = 3;
export const BOSS_DEF_MULTIPLIER = 2;
export const BOSS_ABILITIES: BossAbility[] = ['regen', 'summon', 'aoe_attack', 'shield', 'speed_boost'];


// ===== 비용/보상 =====
export const UNIT_SUMMON_COST = 100;
export const GAMBLE_COST = 100;
export const MAGIC_DRAW_COST = 500;
export const UPGRADE_BASE_COST = 50;
export const ENEMY_KILL_GOLD = 1;
export const BOSS_KILL_GOLD = 50;
export const WAVE_CLEAR_GOLD = 50;
export const MERGE_SUCCESS_RATE = 0.16;
export const MERGE_FAIL_RATE = 0.35;

export const GAMBLE_REWARDS = [
  { weight: 40, type: 'gold' as const, value: 50, label: '50골드' },
  { weight: 25, type: 'gold' as const, value: 150, label: '150골드' },
  { weight: 15, type: 'gold' as const, value: 300, label: '300골드' },
  { weight: 10, type: 'magic' as const, value: 1, label: '랜덤 마법' },
  { weight: 5, type: 'gold' as const, value: 0, label: '꽝!' },
  { weight: 5, type: 'gold' as const, value: 500, label: '대박! 500골드' },
];

export const ALL_COMMANDERS: Commander[] = [
  { id: 'cmd_gold', name: '골드러시', description: '적 처치 시 골드 +30%', ability: 'gold_boost', abilityValue: 30, rarity: 'C', icon: '💰' },
  { id: 'cmd_berserk', name: '광폭화', description: '아군 공격력 +25%, 방어력 -15%', ability: 'berserk', abilityValue: 25, rarity: 'B', icon: '🔥' },
  { id: 'cmd_slow', name: '빙결의 지배자', description: '적 이동속도 -20%', ability: 'slow_aura', abilityValue: 20, rarity: 'B', icon: '❄️' },
  { id: 'cmd_shield', name: '수호자', description: '성문/넥서스 체력 +40%', ability: 'shield', abilityValue: 40, rarity: 'A', icon: '🛡️' },
  { id: 'cmd_crit', name: '암살자', description: '20% 확률로 치명타 (데미지 2.5배)', ability: 'crit_boost', abilityValue: 20, rarity: 'A', icon: '🗡️' },
];
export const DEFAULT_COMMANDER = ALL_COMMANDERS[0];

export const ALL_MAGICS: Omit<Magic, 'id'>[] = [
  { type: 'meteor', name: '메테오', description: '범위 내 적에게 대미지', cooldown: 30000, damage: 200 },
  { type: 'freeze', name: '빙결', description: '모든 적 3초간 이동 정지', cooldown: 25000, duration: 3000 },
  { type: 'heal', name: '치유', description: '성문/넥서스 체력 회복', cooldown: 40000, damage: 150 },
  { type: 'lightning', name: '번개', description: '랜덤 적 5마리에게 높은 대미지', cooldown: 20000, damage: 300 },
  { type: 'barrier', name: '배리어', description: '5초간 성문 무적', cooldown: 60000, duration: 5000 },
];

export const SUMMON_GRADE_WEIGHTS: { grade: UnitGrade; weight: number }[] = [
  { grade: 'F', weight: 45 }, { grade: 'E', weight: 30 }, { grade: 'D', weight: 15 },
  { grade: 'C', weight: 7 }, { grade: 'B', weight: 2.5 }, { grade: 'A', weight: 0.45 }, { grade: 'S', weight: 0.05 },
];

export const GRADE_COLORS: Record<UnitGrade, string> = {
  F: '#888888', E: '#4CAF50', D: '#2196F3', C: '#9C27B0', B: '#FF9800', A: '#F44336', S: '#FFD700',
};
export const ATTACK_TYPE_COLORS: Record<UnitAttackType, string> = {
  penetrate: '#00BCD4', area: '#FF5722', single: '#8BC34A',
};
export const ATTACK_TYPE_LABELS: Record<UnitAttackType, string> = {
  penetrate: '관통', area: '범위', single: '단일',
};
export const ENEMY_TYPE_COLORS: Record<string, string> = {
  A: '#e74c3c', B: '#3498db', C: '#2ecc71', D: '#f39c12', BOSS: '#ff0000',
};
