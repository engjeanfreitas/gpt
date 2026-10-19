import type { Settings } from './types';

let audio: AudioContext | undefined;
export function unlockAudio() {
  audio ??= new AudioContext();
  void audio.resume();
}
export function playAlarm(settings: Settings) {
  if (settings.alarmSound === 'none') return;
  try {
    unlockAudio();
    const context = audio!;
    const tones = settings.alarmSound === 'bell' ? [659, 523, 659, 523] : [523, 659, 784];
    tones.forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + i * 0.27;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime((settings.alarmVolume / 100) * 0.3, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.65);
    });
  } catch {
    /* The visible pause banner remains available if browser audio is blocked. */
  }
}
