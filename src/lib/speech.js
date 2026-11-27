// ═══════════════════════════════════════════════════════════════
// 음성 — 말하기(TTS)와 듣기(음성 인식)를 이 파일 하나에 모았어요.
// 지금은 브라우저 내장 기능을 쓰고, 나중에 AI 음성으로 바꿀 때는
// 이 파일 안쪽만 바꾸면 돼요. 화면 코드는 아래 함수들만 써요:
//
//   speak(text, { rate })      → 다 읽으면 끝나는 Promise
//   stopSpeaking()
//   isRecognitionSupported()   → 음성 인식을 쓸 수 있는지
//   createListener({...})      → { start(), stop() → Promise<{ text, confidence }>, abort() }
// ═══════════════════════════════════════════════════════════════

/* ───────────────── 말하기 (Text-to-Speech) ───────────────── */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;

// 음성 목록은 브라우저가 늦게 알려 줄 때가 있어서 잠깐 기다려요
function loadVoices() {
  if (!synth) return Promise.resolve([]);
  const voices = synth.getVoices();
  if (voices.length) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1000);
  });
}

// 영어(미국) 목소리 중 남자 목소리가 있으면 그걸로
const MALE_NAMES = /\b(male|man|david|mark|guy|daniel|fred|alex|tom|aaron|james|eric|ryan|christopher|andrew|brian|roger|steffan)\b/i;
let chosenVoice;
async function pickVoice() {
  if (chosenVoice !== undefined) return chosenVoice;
  const voices = await loadVoices();
  const english = voices.filter((v) => /^en[-_]US/i.test(v.lang));
  const male = english.find((v) => MALE_NAMES.test(v.name) && !/female/i.test(v.name));
  chosenVoice = male || english[0] || voices.find((v) => /^en/i.test(v.lang)) || null;
  return chosenVoice;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 음성을 못 쓸 때: 글자 수에 비례한 시간만큼 "말하는 척"
const fallbackDuration = (text, rate = 1) => Math.max(1200, (text.length * 65) / rate);

/**
 * 영어 문장을 소리 내어 읽어요. 다 읽으면 끝나요.
 * @param {string} text
 * @param {{ rate?: number }} options rate: 1 = 보통, 0.8 = 천천히
 */
export async function speak(text, { rate = 1 } = {}) {
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    await wait(fallbackDuration(text, rate));
    return;
  }

  const voice = await pickVoice();
  synth.cancel(); // 이전에 읽던 게 있으면 멈추고

  await new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = rate;
    if (voice) utter.voice = voice;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(safety);
      resolve();
    };
    // 브라우저가 "끝났다"고 알려주지 않는 경우를 대비한 안전장치
    const safety = setTimeout(finish, fallbackDuration(text, rate) + 4000);

    utter.onend = finish;
    utter.onerror = () => {
      // 음성이 막혀 있으면 말하는 척만 하고 넘어가요
      clearTimeout(safety);
      wait(fallbackDuration(text, rate)).then(finish);
    };
    synth.speak(utter);
  });
}

/** 읽고 있던 음성을 멈춰요 (화면을 나갈 때 등) */
export function stopSpeaking() {
  synth?.cancel();
}

/* ───────────────── 듣기 (Speech Recognition) ───────────────── */

const Recognition =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

/** 이 브라우저에서 음성 인식을 쓸 수 있는지 */
export function isRecognitionSupported() {
  return Boolean(Recognition);
}

const join = (...parts) => parts.map((p) => p.trim()).filter(Boolean).join(' ');

/**
 * 음성 인식기를 만들어요.
 * - 학습자가 stop()을 부를 때까지 끝나지 않아요 (끼어들기 금지).
 *   말하다 멈춰서 브라우저가 스스로 끊어도 조용히 다시 시작해요.
 * - 인식 중인 글자는 onInterim(text)으로 실시간 전달해요.
 *
 * @param {{ lang?: string, onInterim?: (text: string) => void, onError?: (code: 'denied' | 'unavailable' | 'failed') => void }} options
 */
export function createListener({ lang = 'en-US', onInterim, onError } = {}) {
  if (!Recognition) throw new Error('Speech recognition is not supported');

  const rec = new Recognition();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;

  let active = false; // 학습자가 끝내기 전까지 true
  let committed = ''; // 이전 세션(자동 재시작 전)에서 확정된 글자
  let sessionFinal = ''; // 이번 세션에서 확정된 글자
  let interim = ''; // 아직 확정되지 않은 글자
  const confidences = [];
  let resolveStop = null;

  const currentText = () => join(committed, sessionFinal, interim);

  rec.onresult = (e) => {
    let fin = '';
    let intm = '';
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        fin += ` ${r[0].transcript}`;
        if (i >= e.resultIndex && r[0].confidence > 0) confidences.push(r[0].confidence);
      } else {
        intm += ` ${r[0].transcript}`;
      }
    }
    sessionFinal = fin;
    interim = intm;
    onInterim?.(currentText());
  };

  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      active = false;
      onError?.('denied');
    } else if (e.error === 'audio-capture') {
      active = false;
      onError?.('unavailable');
    } else if (e.error === 'network') {
      active = false;
      onError?.('failed');
    }
    // 'no-speech', 'aborted' 등은 무시 → onend에서 다시 시작해요
  };

  rec.onend = () => {
    // 이번 세션에서 들은 내용은 보관
    committed = join(committed, sessionFinal, interim);
    sessionFinal = '';
    interim = '';

    if (active) {
      // 학습자가 아직 끝내지 않았으면 조용히 다시 듣기
      try {
        rec.start();
      } catch {
        setTimeout(() => {
          try {
            if (active) rec.start();
          } catch {
            /* 다시 시작 실패 — 무시 */
          }
        }, 250);
      }
      return;
    }
    resolveStop?.();
  };

  return {
    start() {
      active = true;
      rec.start();
    },
    /** 학습자가 끝냈을 때: 들은 문장과 평균 확신도(없으면 null)를 돌려줘요 */
    stop() {
      active = false;
      return new Promise((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          const confidence = confidences.length
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : null;
          resolve({ text: currentText(), confidence });
        };
        const timer = setTimeout(finish, 1500); // 브라우저가 늦게 끝내도 1.5초 뒤엔 마무리
        resolveStop = finish;
        try {
          rec.stop();
        } catch {
          finish();
        }
      });
    },
    /** 결과 없이 바로 멈춰요 (화면을 나갈 때 등) */
    abort() {
      active = false;
      try {
        rec.abort();
      } catch {
        /* 이미 멈춰 있음 */
      }
    },
  };
}

/** 인식 결과가 비었거나 너무 짧거나 확신도가 낮으면 "잘 안 들렸어요" */
export function isUnclear({ text, confidence }) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length || text.trim().length < 2) return true;
  return confidence !== null && confidence < 0.3;
}
