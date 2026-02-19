import { useState, useCallback, useRef, useEffect } from 'react';
import { GameState, Unit, Commander, Magic } from '../types/game';
import { resetPendingHits } from '../engine/gameLoop';
import {
  UNIT_SUMMON_COST, GAMBLE_COST, MAGIC_DRAW_COST,
  GAMBLE_REWARDS, GRADE_SELL_PRICE, MERGE_COST,
  MERGE_SUCCESS_RATE, MERGE_FAIL_RATE,
} from '../constants/gameConfig';
import { createUnit, createRandomMagic, weightedRandom, getNextGrade, getUpgradeCost } from '../utils/helpers';

const DUMMY_GATE = { id: 0, maxHp: 0, currentHp: 0, x: 0, y: 0, label: '' };
const DUMMY_NEXUS = { maxHp: 0, currentHp: 0, x: 0, y: 0 };

export function createInitialState(commander: Commander | null): GameState {
  return {
    gold: 300, wave: 0, phase: 'prepare',
    units: [], enemies: [],
    gates: [{ ...DUMMY_GATE }, { ...DUMMY_GATE, id: 1 }],
    nexus: { ...DUMMY_NEXUS },
    upgrades: { penetrateAttack: 0, areaAttack: 0, singleAttack: 0, goldBonus: 0, gateHp: 0 },
    magics: [], commander, score: 0, waveTimer: 0,
    effects: [], spawnTimer: 0, spawnedCount: 0,
  };
}

export function useGameState(commander: Commander | null) {
  const [state, setState] = useState<GameState>(() => createInitialState(commander));

  // stateRef: setState updater가 비동기인 New Architecture에서
  // 유저 액션 시 최신 state를 동기적으로 읽기 위해 사용
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // 유닛 소환 (골드만 차감, 배치는 별도)
  const summonUnit = useCallback((): Unit | null => {
    const current = stateRef.current;
    if (current.gold < UNIT_SUMMON_COST) return null;
    const unit = createUnit();
    setState(prev => {
      if (prev.gold < UNIT_SUMMON_COST) return prev; // 안전 이중 체크
      return { ...prev, gold: prev.gold - UNIT_SUMMON_COST };
    });
    return unit;
  }, []);

  // 유닛을 특정 위치에 배치
  const placeUnit = useCallback((unit: Unit, x: number, y: number) => {
    setState(prev => ({
      ...prev,
      units: [...prev.units, { ...unit, x, y }],
    }));
  }, []);

  const gamble = useCallback((): { type: string; value: number; label: string } | null => {
    const current = stateRef.current;
    if (current.gold < GAMBLE_COST) return null;
    const reward = weightedRandom(GAMBLE_REWARDS);
    setState(prev => {
      if (prev.gold < GAMBLE_COST) return prev;
      let ns = { ...prev, gold: prev.gold - GAMBLE_COST };
      if (reward.type === 'gold') ns.gold += reward.value;
      else if (reward.type === 'magic') ns = { ...ns, magics: [...ns.magics, createRandomMagic()] };
      return ns;
    });
    return reward;
  }, []);

  const upgrade = useCallback((type: 'penetrateAttack' | 'areaAttack' | 'singleAttack' | 'goldBonus' | 'gateHp'): boolean => {
    if (type === 'gateHp') return false;
    const current = stateRef.current;
    const level = current.upgrades[type];
    const cost = getUpgradeCost(level);
    if (current.gold < cost) return false;
    setState(prev => {
      const lvl = prev.upgrades[type];
      const c = getUpgradeCost(lvl);
      if (prev.gold < c) return prev;
      return { ...prev, gold: prev.gold - c, upgrades: { ...prev.upgrades, [type]: lvl + 1 } };
    });
    return true;
  }, []);

  const sellUnit = useCallback((unitId: string) => {
    setState(prev => {
      const unit = prev.units.find(u => u.id === unitId);
      if (!unit) return prev;
      return { ...prev, gold: prev.gold + GRADE_SELL_PRICE[unit.grade], units: prev.units.filter(u => u.id !== unitId) };
    });
  }, []);

  const mergeUnits = useCallback((unitIds: [string, string, string]): 'success' | 'fail' | 'destroy' => {
    const current = stateRef.current;
    const units = unitIds.map(id => current.units.find(u => u.id === id)).filter(Boolean) as Unit[];
    if (units.length !== 3) return 'fail';
    const first = units[0];
    if (!units.every(u => u.attackType === first.attackType && u.grade === first.grade)) return 'fail';
    const cost = MERGE_COST[first.grade];
    if (current.gold < cost || first.grade === 'S') return 'fail';
    const nextGrade = getNextGrade(first.grade);
    if (!nextGrade) return 'fail';

    const roll = Math.random();
    let result: 'success' | 'fail' | 'destroy' = 'fail';
    let newUnit: Unit | null = null;
    if (roll < MERGE_SUCCESS_RATE) {
      result = 'success';
      newUnit = createUnit(first.attackType, nextGrade);
    } else if (roll >= MERGE_SUCCESS_RATE + MERGE_FAIL_RATE) {
      result = 'destroy';
    }

    setState(prev => {
      const prevUnits = unitIds.map(id => prev.units.find(u => u.id === id)).filter(Boolean) as Unit[];
      if (prevUnits.length !== 3 || prev.gold < cost) return prev;
      const remaining = prev.units.filter(u => !unitIds.includes(u.id));
      let ns = { ...prev, gold: prev.gold - cost };
      if (result === 'success' && newUnit) ns = { ...ns, units: [...remaining, newUnit] };
      else if (result === 'destroy') ns = { ...ns, units: remaining };
      return ns;
    });
    return result;
  }, []);

  const drawMagic = useCallback((): Magic | null => {
    const current = stateRef.current;
    if (current.gold < MAGIC_DRAW_COST) return null;
    const magic = createRandomMagic();
    setState(prev => {
      if (prev.gold < MAGIC_DRAW_COST) return prev;
      return { ...prev, gold: prev.gold - MAGIC_DRAW_COST, magics: [...prev.magics, magic] };
    });
    return magic;
  }, []);

  const updateState = useCallback((updater: (prev: GameState) => GameState) => { setState(updater); }, []);
  const resetGame = useCallback(() => { resetPendingHits(); setState(createInitialState(commander)); }, [commander]);

  return { state, summonUnit, placeUnit, gamble, upgrade, sellUnit, mergeUnits, drawMagic, updateState, resetGame };
}
