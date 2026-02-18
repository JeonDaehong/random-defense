import { useState, useCallback } from 'react';
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

  // 유닛 소환 (골드만 차감, 배치는 별도)
  const summonUnit = useCallback((): Unit | null => {
    let unit: Unit | null = null;
    setState(prev => {
      if (prev.gold < UNIT_SUMMON_COST) return prev;
      unit = createUnit();
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
    let result: { type: string; value: number; label: string } | null = null;
    setState(prev => {
      if (prev.gold < GAMBLE_COST) return prev;
      const reward = weightedRandom(GAMBLE_REWARDS);
      result = reward;
      let ns = { ...prev, gold: prev.gold - GAMBLE_COST };
      if (reward.type === 'gold') ns.gold += reward.value;
      else if (reward.type === 'magic') ns = { ...ns, magics: [...ns.magics, createRandomMagic()] };
      return ns;
    });
    return result;
  }, []);

  const upgrade = useCallback((type: 'penetrateAttack' | 'areaAttack' | 'singleAttack' | 'goldBonus' | 'gateHp'): boolean => {
    let success = false;
    setState(prev => {
      if (type === 'gateHp') return prev; // deprecated
      const level = prev.upgrades[type];
      const cost = getUpgradeCost(level);
      if (prev.gold < cost) return prev;
      success = true;
      const ns = { ...prev, gold: prev.gold - cost, upgrades: { ...prev.upgrades, [type]: level + 1 } };
      return ns;
    });
    return success;
  }, []);

  const sellUnit = useCallback((unitId: string) => {
    setState(prev => {
      const unit = prev.units.find(u => u.id === unitId);
      if (!unit) return prev;
      return { ...prev, gold: prev.gold + GRADE_SELL_PRICE[unit.grade], units: prev.units.filter(u => u.id !== unitId) };
    });
  }, []);

  const mergeUnits = useCallback((unitIds: [string, string, string]): 'success' | 'fail' | 'destroy' => {
    let result: 'success' | 'fail' | 'destroy' = 'fail';
    setState(prev => {
      const units = unitIds.map(id => prev.units.find(u => u.id === id)).filter(Boolean) as Unit[];
      if (units.length !== 3) return prev;
      const first = units[0];
      if (!units.every(u => u.attackType === first.attackType && u.grade === first.grade)) return prev;
      const cost = MERGE_COST[first.grade];
      if (prev.gold < cost || first.grade === 'S') return prev;
      const nextGrade = getNextGrade(first.grade);
      if (!nextGrade) return prev;
      const roll = Math.random();
      const remaining = prev.units.filter(u => !unitIds.includes(u.id));
      if (roll < MERGE_SUCCESS_RATE) {
        result = 'success';
        return { ...prev, gold: prev.gold - cost, units: [...remaining, createUnit(first.attackType, nextGrade)] };
      } else if (roll < MERGE_SUCCESS_RATE + MERGE_FAIL_RATE) {
        result = 'fail'; return { ...prev, gold: prev.gold - cost };
      } else {
        result = 'destroy'; return { ...prev, gold: prev.gold - cost, units: remaining };
      }
    });
    return result;
  }, []);

  const drawMagic = useCallback((): Magic | null => {
    let magic: Magic | null = null;
    setState(prev => {
      if (prev.gold < MAGIC_DRAW_COST) return prev;
      magic = createRandomMagic();
      return { ...prev, gold: prev.gold - MAGIC_DRAW_COST, magics: [...prev.magics, magic] };
    });
    return magic;
  }, []);

  const updateState = useCallback((updater: (prev: GameState) => GameState) => { setState(updater); }, []);
  const resetGame = useCallback(() => { resetPendingHits(); setState(createInitialState(commander)); }, [commander]);

  return { state, summonUnit, placeUnit, gamble, upgrade, sellUnit, mergeUnits, drawMagic, updateState, resetGame };
}
