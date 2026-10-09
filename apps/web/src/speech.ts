/**
 * 題目朗讀：用瀏覽器內建的語音（Web Speech API），優先選台灣華語的聲音。
 * 一年級的孩子還讀不太懂國字，朗讀讓他們聽得懂題目和說明。
 */
const synth: SpeechSynthesis | null =
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

let voice: SpeechSynthesisVoice | null = null;

function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices();
  const lang = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  voice =
    voices.find((v) => lang(v) === 'zh-tw') ??
    voices.find((v) => lang(v).startsWith('zh-hant')) ??
    voices.find((v) => lang(v).startsWith('zh')) ??
    null;
}

if (synth) {
  pickVoice();
  synth.addEventListener('voiceschanged', pickVoice);
}

export const speechSupported = synth !== null;

export function speak(text: string) {
  if (!synth) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-TW';
  if (voice) utterance.voice = voice;
  // 放慢一點，讓低年級聽得清楚
  utterance.rate = 0.85;
  synth.speak(utterance);
}

export function stopSpeaking() {
  synth?.cancel();
}
