import { useState } from 'react';
import { speak } from '../lib/speech';
import { isCloseEnough } from '../lib/judgeAnswer';
import useSpeechInput from '../hooks/useSpeechInput';

export const VOICE_HELP = '음성으로 대화하려면 Chrome이나 Safari에서 열어 주세요.';

/**
 * 준비 단계 (시간 제한 없음)
 * 핵심 표현 듣기·따라 말하기 + 할 말 메모
 */
export default function ImmigrationPrep({ scene, memo, onMemoChange, rate, onLog, onStart, onExit }) {
  const mic = useSpeechInput();
  const [activeIndex, setActiveIndex] = useState(null); // 지금 따라 말하는 카드
  const [said, setSaid] = useState({}); // { 카드번호: true } — 따라 말하기 성공
  const [retry, setRetry] = useState({}); // { 카드번호: true } — "한 번 더 들어볼까요?"

  const voiceOff = !mic.supported || mic.error === 'denied' || mic.error === 'unavailable';

  async function toggleRepeat(index, sentence) {
    // 따라 말하기 끝내기
    if (mic.listening && activeIndex === index) {
      const result = await mic.stop();
      setActiveIndex(null);
      onLog({ phase: 'prep', target: sentence, mode: 'voice', text: result.text, durationMs: result.durationMs });
      if (isCloseEnough(sentence, result.text)) {
        setSaid((s) => ({ ...s, [index]: true }));
        setRetry((r) => ({ ...r, [index]: false }));
      } else {
        setRetry((r) => ({ ...r, [index]: true })); // 틀려도 감점·표시 없이 부드럽게
      }
      return;
    }
    if (mic.listening) return; // 다른 카드를 듣는 중이면 무시
    setRetry((r) => ({ ...r, [index]: false }));
    if (mic.start()) setActiveIndex(index);
  }

  return (
    <div className="im-ready">
      <button type="button" className="im-exit" onClick={onExit}>
        나가기
      </button>
      <div className="im-ready-inner">
        <img className="im-ready-poster" src={scene.media.poster} alt="입국 심사관" />
        <p className="im-eyebrow">{scene.chapterLabel}</p>
        <h1 className="im-title">{scene.title}</h1>
        <p className="im-situation">{scene.situation}</p>

        <p className="im-section-label">핵심 표현</p>
        {voiceOff && <p className="im-voice-help">{VOICE_HELP}</p>}
        <ul className="im-phrases">
          {scene.keyExpressions.map((p, i) => {
            const listeningHere = mic.listening && activeIndex === i;
            return (
              <li key={p.en} className={`im-phrase${said[i] ? ' is-said' : ''}`}>
                <div className="im-phrase-text">
                  <p className="im-phrase-en">
                    {said[i] && (
                      <span className="im-phrase-check" aria-label="따라 말하기 완료">
                        ✓
                      </span>
                    )}
                    {p.en}
                  </p>
                  {p.ko && <p className="im-phrase-ko">{p.ko}</p>}
                  {listeningHere && <p className="im-phrase-interim">{mic.interim || '듣고 있어요… 다 말했으면 🎤를 다시 눌러 주세요'}</p>}
                  {retry[i] && !listeningHere && <p className="im-phrase-retry">한 번 더 들어볼까요?</p>}
                </div>
                <div className="im-phrase-actions">
                  <button
                    type="button"
                    className="im-round"
                    onClick={() => speak(p.en, { rate })}
                    disabled={mic.listening}
                    aria-label={`듣기: ${p.en}`}
                  >
                    🔊
                  </button>
                  {!voiceOff && (
                    <button
                      type="button"
                      className={`im-round${listeningHere ? ' is-listening' : ''}`}
                      onClick={() => toggleRepeat(i, p.en)}
                      disabled={mic.listening && !listeningHere}
                      aria-label={listeningHere ? '따라 말하기 끝내기' : `따라 말하기: ${p.en}`}
                    >
                      🎤
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="im-section-label">할 말 메모</p>
        <label className="im-memo">
          <span className="im-memo-guide">{scene.memoGuide}</span>
          <textarea
            value={memo}
            onChange={(e) => onMemoChange(e.target.value)}
            rows={3}
            placeholder="vacation, one week, hotel …"
          />
        </label>

        <button
          type="button"
          className="im-start"
          onClick={() => {
            mic.cancel();
            onStart();
          }}
        >
          준비됐어요, 심사대로 가기
        </button>
      </div>
    </div>
  );
}
