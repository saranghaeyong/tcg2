// Web Audio API Procedural Sound Synthesizer for Person Card Collection
// Generates crisp, cinematic gaming sounds without external audio file loading dependencies.

class SoundManager {
  private ctx: AudioContext | null = null;
  private isSoundEnabled = true;
  private isMusicEnabled = false;
  private masterVolume = 0.8;
  private musicVolume = 0.35;
  private musicInterval: number | null = null;
  private musicGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;
  private isInitialized = false;

  constructor() {
    // Read initial settings from LocalStorage if available
    try {
      const savedSound = localStorage.getItem('pcc_sound_enabled');
      if (savedSound !== null) this.isSoundEnabled = savedSound === 'true';

      const savedMusic = localStorage.getItem('pcc_music_enabled');
      if (savedMusic !== null) this.isMusicEnabled = savedMusic === 'true';

      const savedVol = localStorage.getItem('pcc_master_volume');
      if (savedVol !== null) this.masterVolume = parseFloat(savedVol);

      const savedMusVol = localStorage.getItem('pcc_music_volume');
      if (savedMusVol !== null) this.musicVolume = parseFloat(savedMusVol);
    } catch {
      // Ignore localstorage errors
    }
  }

  public init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      // Master SFX Gain
      this.sfxGainNode = this.ctx.createGain();
      this.sfxGainNode.gain.setValueAtTime(this.isSoundEnabled ? this.masterVolume : 0, this.ctx.currentTime);
      this.sfxGainNode.connect(this.ctx.destination);

      // Music Gain
      this.musicGainNode = this.ctx.createGain();
      this.musicGainNode.gain.setValueAtTime(this.isMusicEnabled ? this.musicVolume : 0, this.ctx.currentTime);
      this.musicGainNode.connect(this.ctx.destination);

      this.isInitialized = true;

      if (this.isMusicEnabled) {
        this.startBackgroundMusic();
      }
    } catch (e) {
      console.warn('AudioContext failed to initialize', e);
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.isSoundEnabled = enabled;
    try {
      localStorage.setItem('pcc_sound_enabled', String(enabled));
    } catch {}

    if (this.sfxGainNode && this.ctx) {
      this.sfxGainNode.gain.setTargetAtTime(enabled ? this.masterVolume : 0, this.ctx.currentTime, 0.05);
    }
  }

  public getSoundEnabled() {
    return this.isSoundEnabled;
  }

  public setMusicEnabled(enabled: boolean) {
    this.isMusicEnabled = enabled;
    try {
      localStorage.setItem('pcc_music_enabled', String(enabled));
    } catch {}

    if (this.musicGainNode && this.ctx) {
      this.musicGainNode.gain.setTargetAtTime(enabled ? this.musicVolume : 0, this.ctx.currentTime, 0.1);
    }

    if (enabled) {
      this.startBackgroundMusic();
    } else {
      this.stopBackgroundMusic();
    }
  }

  public getMusicEnabled() {
    return this.isMusicEnabled;
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('pcc_master_volume', String(this.masterVolume));
    } catch {}

    if (this.sfxGainNode && this.ctx && this.isSoundEnabled) {
      this.sfxGainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  public getMasterVolume() {
    return this.masterVolume;
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('pcc_music_volume', String(this.musicVolume));
    } catch {}

    if (this.musicGainNode && this.ctx && this.isMusicEnabled) {
      this.musicGainNode.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
  }

  public getMusicVolume() {
    return this.musicVolume;
  }

  // --- SOUND EFFECTS ---

  // 1. Button click
  public playButtonClick() {
    if (!this.canPlay()) return;
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.05);

    gain.gain.setValueAtTime(0.3 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGainNode!);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // 2. Pack Hover
  public playPackHover() {
    if (!this.canPlay()) return;
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);

    gain.gain.setValueAtTime(0.08 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGainNode!);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  // 3. Pack Click
  public playPackClick() {
    if (!this.canPlay()) return;
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);

    gain.gain.setValueAtTime(0.5 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGainNode!);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  // 4. Pack Shake
  public playPackShake() {
    if (!this.canPlay()) return;
    const now = this.ctx!.currentTime;
    // Low frequency rumble + filtered noise
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.15);
    osc.frequency.linearRampToValueAtTime(50, now + 0.3);

    gain.gain.setValueAtTime(0.25 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(gain);
    gain.connect(this.sfxGainNode!);
    osc.start(now);
    osc.stop(now + 0.33);
  }

  // 5. Pack Tear (realistic foil rip simulation with white noise buffer)
  public playPackTear() {
    if (!this.canPlay()) return;
    const now = this.ctx!.currentTime;
    const duration = 0.55;
    const bufferSize = Math.floor(this.ctx!.sampleRate * duration);
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 0.7);
    }

    const noise = this.ctx!.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + duration);
    filter.Q.setValueAtTime(3.5, now);

    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.65 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode!);

    noise.start(now);
    noise.stop(now + duration);
  }

  // 6. Pack Opening (bright whoosh + shimmer burst)
  public playPackOpening() {
    if (!this.canPlay()) return;
    const now = this.ctx!.currentTime;

    // Harmonic chords rising
    const freqs = [330, 440, 554, 659, 880];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.7, now + idx * 0.05);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + idx * 0.05 + 0.4);

      gain.gain.setValueAtTime(0.001, now + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.25 * this.masterVolume, now + idx * 0.05 + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.6);

      osc.connect(gain);
      gain.connect(this.sfxGainNode!);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.65);
    });
  }

  // 7. Card Flip
  public playCardFlip() {
    if (!this.canPlay()) return;
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.18);

    gain.gain.setValueAtTime(0.4 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGainNode!);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // 8. Card Swipe
  public playCardSwipe() {
    if (!this.canPlay()) return;
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(150, now + 0.12);

    gain.gain.setValueAtTime(0.2 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGainNode!);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // 9-13. Rarity Reveals
  public playRarityReveal(rarity: string) {
    if (!this.canPlay()) return;
    const now = this.ctx!.currentTime;

    switch (rarity) {
      case 'COMMON': {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(392, now); // G4
        osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.18); // C5
        gain.gain.setValueAtTime(0.35 * this.masterVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(this.sfxGainNode!);
        osc.start(now);
        osc.stop(now + 0.36);
        break;
      }
      case 'UNCOMMON': {
        [440, 554.37, 659.25].forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.3 * this.masterVolume, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.4);
          osc.connect(gain);
          gain.connect(this.sfxGainNode!);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.45);
        });
        break;
      }
      case 'RARE': {
        // Electric chime chord + pulse
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0.35 * this.masterVolume, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.6);
          osc.connect(gain);
          gain.connect(this.sfxGainNode!);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.65);
        });
        break;
      }
      case 'EPIC': {
        // Deep resonant bass swell + shimmering arpeggio
        const subOsc = this.ctx!.createOscillator();
        const subGain = this.ctx!.createGain();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(110, now);
        subOsc.frequency.exponentialRampToValueAtTime(220, now + 0.4);
        subGain.gain.setValueAtTime(0.3 * this.masterVolume, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        subOsc.connect(subGain);
        subGain.connect(this.sfxGainNode!);
        subOsc.start(now);
        subOsc.stop(now + 0.72);

        [440, 554, 659, 880, 1108].forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.32 * this.masterVolume, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.7);
          osc.connect(gain);
          gain.connect(this.sfxGainNode!);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.75);
        });
        break;
      }
      case 'ULTRA_RARE': {
        // Prismatic sparkling fanfare
        [587.33, 739.99, 880, 1174.66, 1479.98].forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.35 * this.masterVolume, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.9);
          osc.connect(gain);
          gain.connect(this.sfxGainNode!);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.95);
        });
        break;
      }
      case 'LEGENDARY': {
        // Epic cinematic bass drop + celestial brass triumph fanfare
        const sub = this.ctx!.createOscillator();
        const subG = this.ctx!.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(65, now);
        sub.frequency.exponentialRampToValueAtTime(32, now + 0.8);
        subG.gain.setValueAtTime(0.7 * this.masterVolume, now);
        subG.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        sub.connect(subG);
        subG.connect(this.sfxGainNode!);
        sub.start(now);
        sub.stop(now + 1.25);

        // Fanfare notes: D4, F#4, A4, D5, F#5, A5
        const fanfareNotes = [293.66, 369.99, 440.0, 587.33, 739.99, 880.0];
        fanfareNotes.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.4 * this.masterVolume, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 1.2);
          osc.connect(gain);
          gain.connect(this.sfxGainNode!);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 1.3);
        });
        break;
      }
      default:
        this.playCardFlip();
    }
  }

  // 14. Collection Added
  public playCollectionAdded() {
    if (!this.canPlay()) return;
    const now = this.ctx!.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.3 * this.masterVolume, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.4);
      osc.connect(gain);
      gain.connect(this.sfxGainNode!);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.45);
    });
  }

  // 15. Duplicate Card chime
  public playDuplicateSound() {
    if (!this.canPlay()) return;
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(420, now + 0.08);
    gain.gain.setValueAtTime(0.25 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.sfxGainNode!);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  // 16. Pack Complete
  public playPackComplete() {
    if (!this.canPlay()) return;
    const now = this.ctx!.currentTime;
    // Triumphant multi-chord
    const chords = [
      [349.23, 440, 523.25], // F major
      [392.00, 493.88, 587.33], // G major
      [523.25, 659.25, 783.99, 1046.50] // C major climax
    ];

    chords.forEach((chord, chordIdx) => {
      const chordTime = now + chordIdx * 0.22;
      chord.forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, chordTime);
        gain.gain.setValueAtTime(0.25 * this.masterVolume, chordTime);
        gain.gain.exponentialRampToValueAtTime(0.001, chordTime + (chordIdx === 2 ? 1.0 : 0.4));
        osc.connect(gain);
        gain.connect(this.sfxGainNode!);
        osc.start(chordTime);
        osc.stop(chordTime + (chordIdx === 2 ? 1.1 : 0.45));
      });
    });
  }

  // --- AMBIENT BACKGROUND MUSIC GENERATOR ---
  private startBackgroundMusic() {
    if (this.musicInterval !== null) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    // Ambient pentatonic chords sequence (F, G, Am, C) played on soft sine/triangle pads
    const chordProgressions = [
      [174.61, 261.63, 329.63], // F, C, E
      [196.00, 293.66, 392.00], // G, D, G
      [220.00, 329.63, 440.00], // A, E, A
      [261.63, 329.63, 523.25], // C, E, C
    ];

    let currentChord = 0;

    const playAmbientChord = () => {
      if (!this.isMusicEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const notes = chordProgressions[currentChord % chordProgressions.length];
      currentChord++;

      const now = this.ctx.currentTime;
      const duration = 3.6;

      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        // Slow soft swell and fade
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.12 * this.musicVolume, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.musicGainNode!);
        osc.start(now);
        osc.stop(now + duration + 0.1);
      });
    };

    playAmbientChord();
    this.musicInterval = window.setInterval(playAmbientChord, 3800);
  }

  private stopBackgroundMusic() {
    if (this.musicInterval !== null) {
      window.clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  private canPlay(): boolean {
    if (!this.isSoundEnabled) return false;
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return !!this.ctx && this.ctx.state === 'running';
  }
}

export const soundManager = new SoundManager();
