import { useState } from 'react';
import { speak, isUnclear } from '../lib/speech';
import { isCloseEnough } from '../lib/judgeAnswer';
import useSpeechInput from '../hooks/useSpeechInput';
import './ImmigrationReview.css';

const RETRY_THRESHOLD = 0.7; // 재도전: 모범 문장 단어의 70% 이상을 말하면 성공
const UNCLEAR_MSG = '잘 안 들렸어요. 한 번 더 말해 볼까요?';
const VOICE_HELP = '음성으로 말하려면 Chrome이나 Safari에서 열어 주세요. 지금은 글자로 입력해도 괜찮아요.';

/* ═════════ 오늘의 코칭 + 재도전 ═════════ */
/**
 * @param coaching { praise, improve } (src/lib/coaching.js가 만든 것)
 * @param onAttempt({ text, mode, durationMs, success }) 재도전 한 번 할 때마다
 * @param onFinish() "오늘의 성취 보기" 또는 "다음에 할게요"
 */
export function CoachingView({ scene, coaching, rate, onRateChange, onAttempt, onFinish, onExit }) {
  const { praise, improve } = coaching;
  const mic = useSpeechInput();
  const voiceOff = !mic.supported || mic.error === 'denied' || mic.error === 'unavailable';

  const [result, setResult] = useState('idle'); // idle | success | again
  const [misses, setMisses] = useState(0); // 재도전에서 아직 안 된 횟수
  const [notice, setNotice] = useState('');
  const [text, setText] = useState('');
  const [lastSaid, setLastSaid] = useState('');

  function check(said, meta) {
    setLastSaid(said);
    const success = isCloseEnough(improve.model, said, RETRY_THRESHOLD);
    onAttempt({ text: said, success, ...meta });
    if (success) {
      setResult('success');
    } else {
      setResult('again');
      setMisses((n) => n + 1);
    }
  }

  async function toggleMic() {
    if (mic.listening) {
      const r = await mic.stop();
      if (isUnclear(r)) {
        setNotice(UNCLEAR_MSG); // 시도 횟수에 넣지 않아요
        return;
      }
      check(r.text, { mode: 'voice', durationMs: r.durationMs });
      return;
    }
    setNotice('');
    mic.start();
  }

  function sendText(e) {
    e.preventDefault();
    const said = text.trim();
    if (!said) return;
    setText('');
    check(said, { mode: 'text' });
  }

  return (
    <div className="rv-screen">
      <button type="button" className="rv-exit" onClick={onExit}>
        나가기
      </button>
      <div className="rv-inner">
        <p className="rv-eyebrow">{scene.chapterLabel} · {scene.title}</p>
        <h1 className="rv-title">오늘의 코칭</h1>
        <p className="rv-lead">오늘 심사대에서 한 말을 함께 돌아볼게요.</p>

        {praise && (
          <section className="rv-card rv-card--praise">
            <p className="rv-card-label">👏 잘한 점</p>
            <blockquote className="rv-quote">“{praise.quote}”</blockquote>
            <p className="rv-card-text">{praise.message}</p>
          </section>
        )}

        <section className="rv-card">
          <p className="rv-card-label">🌱 다음엔 이렇게</p>
          <p className="rv-card-text">{improve.message}</p>
          <div className="rv-compare">
            <div className="rv-compare-col">
              <p className="rv-compare-label">내가 한 말</p>
              <p className="rv-said">{improve.said ? `“${improve.said}”` : '(이번엔 대답을 건너뛰었어요)'}</p>
            </div>
            <div className="rv-compare-col rv-compare-col--model">
              <p className="rv-compare-label">이렇게 말하면 더 자연스러워요</p>
              <div className="rv-model-row">
                <p className="rv-model">{improve.model}</p>
                <button type="button" className="rv-round" onClick={() => speak(improve.model, { rate })} aria-label="듣기">
                  🔊
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 재도전 (흐름의 한 단계) */}
        <section className={`rv-card rv-retry${result === 'success' ? ' is-success' : ''}`}>
          <p className="rv-card-label">🔁 한 번 더 말해 볼까요?</p>
          <div className="rv-model-row rv-model-row--big">
            <p className="rv-model">{improve.model}</p>
            <button
              type="button"
              className="rv-round"
              onClick={() => speak(improve.model, { rate })}
              disabled={mic.listening}
              aria-label="듣기"
            >
              🔊
            </button>
          </div>

          {result === 'success' ? (
            <>
              <p className="rv-success">좋아요! 훨씬 자연스러워졌어요.</p>
              {lastSaid && <p className="rv-said rv-said--mine">“{lastSaid}”</p>}
              <button type="button" className="rv-primary" onClick={onFinish}>
                오늘의 성취 보기
              </button>
            </>
          ) : (
            <>
              <p className={`rv-live${mic.listening ? ' is-listening' : ''}`} aria-live="polite">
                {mic.listening
                  ? mic.interim || '듣고 있어요… 다 말했으면 마이크를 다시 눌러 주세요'
                  : notice ||
                    (result === 'again'
                      ? '거의 다 왔어요! 🔊로 한 번 더 듣고 천천히 따라 해 볼까요?'
                      : voiceOff
                        ? ''
                        : '🔊로 듣고, 🎤를 눌러 따라 말해 보세요')}
              </p>

              {voiceOff ? (
                <>
                  <p className="rv-voice-help">{VOICE_HELP}</p>
                  <form className="rv-form" onSubmit={sendText}>
                    <input
                      className="rv-input"
                      type="text"
                      lang="en"
                      autoComplete="off"
                      placeholder="문장을 입력해 보세요"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      aria-label="문장 입력"
                    />
                    <button type="submit" className="rv-send" disabled={!text.trim()}>
                      보내기
                    </button>
                  </form>
                </>
              ) : (
                <button
                  type="button"
                  className={`rv-mic${mic.listening ? ' is-listening' : ''}`}
                  onClick={toggleMic}
                  aria-label={mic.listening ? '말하기 끝내기' : '말하기 시작'}
                >
                  {mic.listening ? '■' : '🎤'}
                </button>
              )}

              {/* 두 번 이상 해 본 뒤에만 보여요 */}
              {misses >= 2 && !mic.listening && (
                <button type="button" className="rv-later" onClick={onFinish}>
                  다음에 할게요
                </button>
              )}
            </>
          )}
        </section>

        <div className="rv-rate" role="group" aria-label="말하기 속도">
          {[0.8, 1].map((r) => (
            <button key={r} type="button" className={rate === r ? 'is-on' : ''} onClick={() => onRateChange(r)} aria-pressed={rate === r}>
              {r}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═════════ 오늘의 성취 ═════════ */
/**
 * @param missions [{ id, label, done }]
 * @param expressions 오늘 새로 말한 표현 (문장 배열)
 * @param sentenceCount 오늘 말한 문장 수
 * @param longestWords  가장 길게 말한 문장의 단어 수
 */
export function AchievementView({ scene, missions, expressions, sentenceCount, longestWords, rate, onNext, onRestart, onExit }) {
  // 스탬프 날짜 (화면에 들어올 때 한 번만)
  const [today] = useState(() =>
    new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()
  );
  return (
    <div className="rv-screen">
      <button type="button" className="rv-exit" onClick={onExit}>
        나가기
      </button>
      <div className="rv-inner">
        <p className="rv-eyebrow">{scene.chapterLabel} · {scene.title}</p>
        <h1 className="rv-title">오늘의 성취</h1>

        {/* 여권 스탬프 */}
        <div className="rv-passport">
          <div className="rv-stamp" role="img" aria-label={`${scene.stamp.place} ${scene.stamp.day} ${scene.stamp.label} 스탬프`}>
            <span className="rv-stamp-place">{scene.stamp.place}</span>
            <span className="rv-stamp-line">
              {scene.stamp.day} · {scene.stamp.label}
            </span>
            <span className="rv-stamp-date">{today}</span>
          </div>
        </div>

        <section className="rv-card">
          <p className="rv-card-label">✅ 완료한 미션</p>
          <ul className="rv-missions">
            {missions.map((m) => (
              <li key={m.id} className={m.done ? 'is-done' : ''}>
                <span className="rv-check" aria-hidden="true">
                  {m.done ? '✓' : ''}
                </span>
                {m.label}
              </li>
            ))}
          </ul>
        </section>

        {expressions.length > 0 && (
          <section className="rv-card">
            <p className="rv-card-label">🗣️ 오늘 새로 말한 표현</p>
            <ul className="rv-expressions">
              {expressions.map((e) => (
                <li key={e} className="rv-model-row">
                  <p className="rv-model">{e}</p>
                  <button type="button" className="rv-round" onClick={() => speak(e, { rate })} aria-label={`듣기: ${e}`}>
                    🔊
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rv-card rv-records">
          <div>
            <p className="rv-record-value">{sentenceCount}</p>
            <p className="rv-record-label">오늘 말한 문장</p>
          </div>
          <div>
            <p className="rv-record-value">{longestWords}</p>
            <p className="rv-record-label">가장 길게 말한 문장의 단어 수</p>
          </div>
        </section>

        <button type="button" className="rv-primary" onClick={onNext}>
          다음: 수하물 찾기
        </button>
        <button type="button" className="rv-text-btn" onClick={onRestart}>
          처음부터 다시
        </button>
      </div>
    </div>
  );
}
