import { Audio } from 'expo-av';

type SfxKey = 'attack' | 'explosion' | 'wave_start' | 'game_over' | 'boss' | 'summon';

const SFX_FILES: Record<SfxKey, number> = {
  attack: require('../../assets/sounds/attack.wav'),
  explosion: require('../../assets/sounds/explosion.wav'),
  wave_start: require('../../assets/sounds/wave_start.wav'),
  game_over: require('../../assets/sounds/game_over.wav'),
  boss: require('../../assets/sounds/boss.wav'),
  summon: require('../../assets/sounds/summon.wav'),
};

let muted = false;

// 풀링: 동시 재생을 위해 매번 새 인스턴스 (짧은 효과음)
async function playSfx(key: SfxKey, volume = 0.5) {
  if (muted) return;
  try {
    const { sound } = await Audio.Sound.createAsync(SFX_FILES[key], {
      shouldPlay: true,
      volume,
    });
    // 재생 끝나면 자동 해제
    sound.setOnPlaybackStatusUpdate(status => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch {
    // 무시
  }
}

export const SoundManager = {
  async init() {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
    } catch {}
  },

  async stopBgm() {},

  playAttack() { playSfx('attack', 0.2); },
  playExplosion() { playSfx('explosion', 0.35); },
  playWaveStart() { playSfx('wave_start', 0.4); },
  playGameOver() { playSfx('game_over', 0.5); },
  playBossSpawn() { playSfx('boss', 0.45); },
  playSummon() { playSfx('summon', 0.4); },

  setMuted(m: boolean) {
    muted = m;
  },

  getMuted() { return muted; },

  async cleanup() {},
};
