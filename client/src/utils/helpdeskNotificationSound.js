const STORAGE_KEY = 'helpdesk_notification_sound_enabled';

export function isHelpdeskNotificationSoundEnabled() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'false') return false;
  } catch {
    // ignore
  }
  return true;
}

export function setHelpdeskNotificationSoundEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

let audioContext = null;

/**
 * Short two-tone chime for inbound helpdesk alerts (no asset file required).
 */
export function playHelpdeskNotificationSound() {
  if (!isHelpdeskNotificationSoundEnabled()) return;
  if (typeof window === 'undefined') return;

  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioContext) audioContext = new Ctx();
    const ctx = audioContext;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    gain.connect(ctx.destination);

    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(880, now + 0.02, 0.12);
    playTone(1174, now + 0.16, 0.14);
  } catch {
    // Audio may be blocked until user gesture — fail silently.
  }
}
