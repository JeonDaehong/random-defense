import AsyncStorage from '@react-native-async-storage/async-storage';
import { SaveData, Commander } from '../types/game';
import { DEFAULT_COMMANDER } from '../constants/gameConfig';

const SAVE_KEY = 'mobile_defense_save';

const DEFAULT_SAVE: SaveData = {
  commanders: [DEFAULT_COMMANDER],
  selectedCommanderId: DEFAULT_COMMANDER.id,
  highScore: 0,
  totalGold: 0,
};

export async function loadSave(): Promise<SaveData> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    if (!raw) return DEFAULT_SAVE;
    return JSON.parse(raw) as SaveData;
  } catch {
    return DEFAULT_SAVE;
  }
}

export async function saveSave(data: SaveData): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // silent fail
  }
}

export async function updateHighScore(score: number): Promise<void> {
  const data = await loadSave();
  if (score > data.highScore) {
    data.highScore = score;
    await saveSave(data);
  }
}

export async function addCommander(commander: Commander): Promise<void> {
  const data = await loadSave();
  if (!data.commanders.find(c => c.id === commander.id)) {
    data.commanders.push(commander);
    await saveSave(data);
  }
}

export async function setSelectedCommander(commanderId: string): Promise<void> {
  const data = await loadSave();
  data.selectedCommanderId = commanderId;
  await saveSave(data);
}
