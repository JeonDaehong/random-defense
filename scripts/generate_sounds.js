const fs = require('fs');
const path = require('path');

// WAV file header generator
function createWavHeader(dataLength, sampleRate = 44100, numChannels = 1, bitsPerSample = 16) {
    const buffer = Buffer.alloc(44);
    
    // "RIFF" chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4); // File size - 8
    buffer.write('WAVE', 8);
    
    // "fmt " sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28); // ByteRate
    buffer.writeUInt16LE(numChannels * bitsPerSample / 8, 32); // BlockAlign
    buffer.writeUInt16LE(bitsPerSample, 34);
    
    // "data" sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);
    
    return buffer;
}

// Generate PCM samples
function generateSamples(duration, sampleRate, generator) {
    const numSamples = Math.floor(duration * sampleRate);
    const buffer = Buffer.alloc(numSamples * 2); // 16-bit = 2 bytes per sample
    
    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const sample = generator(t, i, numSamples);
        // Clamp and convert to 16-bit signed integer
        const value = Math.max(-1, Math.min(1, sample));
        buffer.writeInt16LE(Math.floor(value * 32767), i * 2);
    }
    
    return buffer;
}

// Save WAV file
function saveWav(filename, samples, sampleRate = 44100) {
    const header = createWavHeader(samples.length, sampleRate);
    const wav = Buffer.concat([header, samples]);
    const filepath = path.join(__dirname, '..', 'assets', 'sounds', filename);
    fs.writeFileSync(filepath, wav);
    console.log(`Created: ${filename} (${samples.length} bytes)`);
}

// Apply envelope (ADSR-like)
function envelope(t, duration, attack = 0.01, release = 0.05) {
    if (t < attack) {
        return t / attack; // Attack
    } else if (t > duration - release) {
        return (duration - t) / release; // Release
    }
    return 1; // Sustain
}

// Sound generators
const sounds = {
    // 1. Attack - short blip/hit sound
    'attack.wav': () => {
        const duration = 0.1; // 100ms
        const sampleRate = 44100;
        return generateSamples(duration, sampleRate, (t, i, total) => {
            const freq = 800;
            const env = envelope(t, duration, 0.005, 0.03);
            return Math.sin(2 * Math.PI * freq * t) * env * 0.6;
        });
    },
    
    // 2. Explosion - descending frequency
    'explosion.wav': () => {
        const duration = 0.3; // 300ms
        const sampleRate = 44100;
        return generateSamples(duration, sampleRate, (t, i, total) => {
            const progress = t / duration;
            const freq = 400 - (300 * progress); // 400Hz → 100Hz
            const env = envelope(t, duration, 0.01, 0.1);
            
            // Add noise for explosion effect
            const noise = (Math.random() - 0.5) * 0.3;
            const tone = Math.sin(2 * Math.PI * freq * t) * 0.7;
            
            return (tone + noise) * env * 0.5;
        });
    },
    
    // 3. Wave start - rising tone
    'wave_start.wav': () => {
        const duration = 0.4; // 400ms
        const sampleRate = 44100;
        return generateSamples(duration, sampleRate, (t, i, total) => {
            const progress = t / duration;
            const freq = 300 + (500 * progress); // 300Hz → 800Hz
            const env = envelope(t, duration, 0.05, 0.1);
            return Math.sin(2 * Math.PI * freq * t) * env * 0.5;
        });
    },
    
    // 4. Game over - descending sad tones
    'game_over.wav': () => {
        const duration = 0.8; // 800ms
        const sampleRate = 44100;
        return generateSamples(duration, sampleRate, (t, i, total) => {
            const progress = t / duration;
            const freq = 600 - (400 * progress); // 600Hz → 200Hz
            const env = envelope(t, duration, 0.1, 0.2);
            
            // Add harmonic for sadness
            const fundamental = Math.sin(2 * Math.PI * freq * t);
            const harmonic = Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.3;
            
            return (fundamental + harmonic) * env * 0.4;
        });
    },
    
    // 5. Boss - deep rumble with overtones
    'boss.wav': () => {
        const duration = 0.5; // 500ms
        const sampleRate = 44100;
        return generateSamples(duration, sampleRate, (t, i, total) => {
            const freq = 150;
            const env = envelope(t, duration, 0.05, 0.15);
            
            // Multiple harmonics for rumble effect
            const fundamental = Math.sin(2 * Math.PI * freq * t);
            const harmonic2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.5;
            const harmonic3 = Math.sin(2 * Math.PI * freq * 3 * t) * 0.25;
            const subharmonic = Math.sin(2 * Math.PI * freq * 0.5 * t) * 0.3;
            
            return (fundamental + harmonic2 + harmonic3 + subharmonic) * env * 0.3;
        });
    },
    
    // 6. Summon - bright chime
    'summon.wav': () => {
        const duration = 0.3; // 300ms
        const sampleRate = 44100;
        return generateSamples(duration, sampleRate, (t, i, total) => {
            const progress = t / duration;
            const freq = 1000 + (200 * progress); // 1000Hz → 1200Hz
            const env = envelope(t, duration, 0.01, 0.15);
            
            // Bell-like harmonics
            const fundamental = Math.sin(2 * Math.PI * freq * t);
            const harmonic2 = Math.sin(2 * Math.PI * freq * 2.4 * t) * 0.4;
            const harmonic3 = Math.sin(2 * Math.PI * freq * 3.8 * t) * 0.2;
            
            return (fundamental + harmonic2 + harmonic3) * env * 0.4;
        });
    },
    
    // 7. BGM - ambient pad chord (A minor: A, C, E)
    'bgm.wav': () => {
        const duration = 3.0; // 3 seconds
        const sampleRate = 44100;
        return generateSamples(duration, sampleRate, (t, i, total) => {
            // A minor chord frequencies (A3, C4, E4)
            const a = 220; // A3
            const c = 261.63; // C4
            const e = 329.63; // E4
            
            // Smooth envelope for looping
            const env = envelope(t, duration, 0.3, 0.3);
            
            // Soft pad with harmonics
            const note1 = Math.sin(2 * Math.PI * a * t) * 0.3;
            const note2 = Math.sin(2 * Math.PI * c * t) * 0.25;
            const note3 = Math.sin(2 * Math.PI * e * t) * 0.2;
            
            // Add subtle harmonics
            const harmonic1 = Math.sin(2 * Math.PI * a * 2 * t) * 0.1;
            const harmonic2 = Math.sin(2 * Math.PI * c * 2 * t) * 0.08;
            
            return (note1 + note2 + note3 + harmonic1 + harmonic2) * env * 0.5;
        });
    }
};

// Generate all sounds
console.log('Generating WAV sound files...\n');

for (const [filename, generator] of Object.entries(sounds)) {
    const samples = generator();
    saveWav(filename, samples);
}

console.log('\nAll sound files generated successfully!');
