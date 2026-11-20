/**
 * Lightweight WebAudio sound effect synthesizer.
 * Zero audio files needed; off by default; respects user toggle.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioCtx();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playTone(
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  type: OscillatorType = 'triangle',
  peakGain = 0.12
) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startTime = ctx.currentTime + startOffsetSec;
    const stopTime = startTime + durationSec;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(stopTime);
  } catch {
    // Ignore audio context restrictions
  }
}

/**
 * Coin chime when a payment lands in the sats purse/jar (two bright marimba/coin notes).
 */
export function playCoinLandingSound(soundEnabled: boolean): void {
  if (!soundEnabled) return;
  playTone(987.77, 0, 0.14, 'sine', 0.14); // B5
  playTone(1318.51, 0.09, 0.22, 'triangle', 0.16); // E6
}

/**
 * Gentle wooden tap when creating an invoice or toggling sound on.
 */
export function playTapSound(soundEnabled: boolean): void {
  if (!soundEnabled) return;
  playTone(587.33, 0, 0.08, 'triangle', 0.1); // D5
}

/**
 * Soft puzzled two-note descend when an invoice expires or channel capacity is insufficient.
 */
export function playConfusedOutcomeSound(soundEnabled: boolean): void {
  if (!soundEnabled) return;
  playTone(392.0, 0, 0.14, 'triangle', 0.11); // G4
  playTone(311.13, 0.12, 0.2, 'triangle', 0.11); // Eb4
}

/**
 * Cheerful 3-note fanfare when completing a lesson check or spotting all scams.
 */
export function playLessonFanfareSound(soundEnabled: boolean): void {
  if (!soundEnabled) return;
  playTone(523.25, 0, 0.12, 'triangle', 0.12); // C5
  playTone(659.25, 0.1, 0.12, 'triangle', 0.12); // E5
  playTone(783.99, 0.2, 0.24, 'triangle', 0.14); // G5
}
