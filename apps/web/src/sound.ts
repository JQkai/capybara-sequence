import { settings } from './store';

/** 音效：用 Web Audio 即時合成，不需要音檔，也能離線使用 */
type AudioContextClass = typeof AudioContext;

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!ctx) {
    const Ctor: AudioContextClass | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // 瀏覽器要求使用者操作後才能出聲；音效都在點擊後觸發，這裡把暫停的 context 叫醒
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(frequency: number, start: number, duration: number, type: OscillatorType = 'sine', volume = 0.18) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

/** 答對：往上的兩個音 */
export function playCorrect() {
  if (!settings.sound) return;
  tone(659, 0, 0.18);
  tone(988, 0.12, 0.3);
}

/** 答錯：低低的一聲，不要太刺耳 */
export function playWrong() {
  if (!settings.sound) return;
  tone(247, 0, 0.25, 'triangle', 0.15);
  tone(196, 0.15, 0.3, 'triangle', 0.12);
}

/** 結算：拿幾顆星就響幾個音 */
export function playStars(stars: number) {
  if (!settings.sound) return;
  [523, 659, 784].slice(0, stars).forEach((f, i) => tone(f, i * 0.22, 0.35));
  if (stars === 3) tone(1047, 0.7, 0.5);
}
