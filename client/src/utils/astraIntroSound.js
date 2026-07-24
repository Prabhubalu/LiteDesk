let audioContext = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  return audioContext;
}

/**
 * Soft whoosh + rising chime for Astra first-open cinematic (no asset file).
 * Safe to call from a user gesture (AI orb click).
 */
export function playAstraIntroSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Filtered noise whoosh (center → edge reveal)
    const duration = 1.35;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(0.7, now);
    filter.frequency.setValueAtTime(280, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 0.9);

    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.0001, now);
    whooshGain.gain.exponentialRampToValueAtTime(0.055, now + 0.18);
    whooshGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);

    // Soft rising triad (brand-adjacent, gentle)
    const tones = [
      { freq: 392.0, at: 0.42, peak: 0.028 }, // G4
      { freq: 523.25, at: 0.55, peak: 0.032 }, // C5
      { freq: 659.25, at: 0.7, peak: 0.026 }, // E5
    ];
    tones.forEach(({ freq, at, peak }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + at);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(peak, now + at + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 1.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + 1.2);
    });
  } catch {
    // Autoplay / AudioContext may be blocked — fail silently.
  }
}

/**
 * Short resolve tone when user continues into Astra from the intro.
 */
export function playAstraIntroResolveSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const play = (freq, start, peak) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    };

    play(523.25, now, 0.045);
    play(783.99, now + 0.08, 0.038);
  } catch {
    // ignore
  }
}
