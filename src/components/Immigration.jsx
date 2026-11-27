import { useEffect, useRef, useState } from 'react';
import defaultScene from '../data/ch1_step1_immigration';
import { speak, stopSpeaking, isUnclear } from '../lib/speech';
import { judgeAnswer, isCloseEnough, wordCount } from '../lib/judgeAnswer';
import { buildCoaching } from '../lib/coaching';
import { findUnfinishedSession, createSession, updateSession, hasCompletedStep } from '../lib/stepSessions';
import { hasProgress } from '../lib/journeyProgress';
import useSpeechInput from '../hooks/useSpeechInput';
import OfficerVideo from './OfficerVideo';
import ImmigrationPrep, { VOICE_HELP } from './ImmigrationPrep';
import { CoachingView, AchievementView } from './ImmigrationReview';
import './Immigration.css';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MIN_CHECK_MS = 800; // "확인 중…"을 최소 이만큼은 보여줘요
const STAMP_DELAY_MS = 1500; // 도장 영상 시작 후 도장이 찍히기까지
const HINT_NAMES = ['방향', '단어', '문장 틀'];
const UNCLEAR_MSG = '잘 안 들렸어요. 한 번 더 말해 볼까요?';
const TRY_FIRST_MSG = '먼저 스스로 말해 보세요. 천천히 생각해도 괜찮아요.';

// 질문마다 받을 수 있는 도움 단계 수
// repeat: 따라 말할 문장이 처음부터 보여서 도움 없음 / choice: 선택지 1단계 / 나머지: 힌트 3단계
const maxHelp = (turn) => (turn.level === 'repeat' ? 0 : turn.level === 'choice' ? 1 : turn.hints.length);

// 질문별 기록의 빈 틀: [{ id, level, attempts: [{ text, passed }], hintsUsed, helpShownAt }]
const emptyLogs = (turns) => turns.map((t) => ({ id: t.id, level: t.level, attempts: [], hintsUsed: 0, helpShownAt: null }));
const isPassed = (log) => log.attempts.some((a) => a.passed);
// 끝난 질문 = 통과했거나, 정해진 횟수만큼 시도해서 자연스럽게 넘어간 질문
const isTurnDone = (log, maxAttempts) => isPassed(log) || log.attempts.length >= maxAttempts;

/**
 * Chapter 1 · Step 1 · 입국 심사
 * 준비 → 단계적 대화 → 통과 → 오늘의 코칭 → 재도전 → 오늘의 성취
 * 내용은 src/data 폴더의 장면 데이터에서 가져와요.
 * @param scene         장면 데이터 (기본: 입국 심사)
 * @param startMode     'auto'(멈춘 곳이 있으면 물어보기) | 'resume'(바로 이어하기) | 'replay'(새로 처음부터)
 * @param onExit()      "나가기" → HOME으로
 * @param onNext()      "다음: 수하물 찾기"
 * @param onCompleted() 성취 기록까지 끝났을 때
 */
export default function Immigration({ scene = defaultScene, startMode = 'auto', onExit, onNext, onCompleted }) {
  const { turns } = scene;

  // loading(불러오는 중) | resume(이어하기 질문) | prep(준비) | talk(대화) | done(통과)
  // | coaching(오늘의 코칭 + 재도전) | achievement(오늘의 성취)
  const [phase, setPhase] = useState('loading');
  const [pendingSession, setPendingSession] = useState(null); // 이어할 수 있는 지난 세션
  const [coaching, setCoaching] = useState(null);
  const [achievement, setAchievement] = useState(null);
  const [memo, setMemo] = useState(''); // 준비 단계에서 쓴 메모
  const [rate, setRate] = useState(1); // 말하기 속도: 1 또는 0.8

  const [officer, setOfficer] = useState('idle'); // 심사관 영상: idle | talk | check | pass | smile
  const [caption, setCaption] = useState(''); // 영상 아래 자막 (심사관이 지금 한 말)
  const [draft, setDraft] = useState(null); // 말한 뒤 보내기 전 확인: { text, original, focus }
  const [busy, setBusy] = useState(null); // null | 'speaking' | 'checking' | 'passing'
  const [messages, setMessages] = useState([]); // 대화 말풍선 (= 자막)
  const [turnIndex, setTurnIndex] = useState(0);
  const [attempts, setAttempts] = useState(0); // 지금 질문에서 통과 못 한 횟수
  const [hintsShown, setHintsShown] = useState(0); // 지금 질문에서 받은 도움 단계 (0 = 아직 도움 없음)
  const [missions, setMissions] = useState({}); // { turnId: 'pass' | 'done' }
  const [notice, setNotice] = useState(''); // 마이크 위 안내 ("잘 안 들렸어요" 등)
  const [typing, setTyping] = useState(false); // 키보드 입력창 열림
  const [text, setText] = useState('');
  const [memoOpen, setMemoOpen] = useState(false);
  const [stamped, setStamped] = useState(false);
  const [finished, setFinished] = useState(false);

  const mic = useSpeechInput();
  const voiceOff = !mic.supported || mic.error === 'denied' || mic.error === 'unavailable';
  const showTextInput = typing || voiceOff;

  // 발화 기록 (마이크를 누르고 있던 시간·횟수 등)
  const record = useRef({ sceneId: scene.id, startedAt: null, talkStartedAt: null, finishedAt: null, utterances: [] });
  const logUtterance = (entry) => record.current.utterances.push({ at: Date.now(), ...entry });

  // ── 저장(Supabase step_sessions)에 쓰는 값들 ──
  const sessionIdRef = useRef(null);
  const logsRef = useRef(emptyLogs(turns)); // 질문별 기록
  const baseRef = useRef({ utterances: 0, speakingMs: 0 }); // 이어하기 전 세션에서 이미 쌓인 값
  const retryRef = useRef({ count: 0, texts: [], success: false }); // 재도전 기록
  const memoRef = useRef('');
  useEffect(() => {
    memoRef.current = memo;
  }, [memo]);

  // 발화 횟수·시간 = 마이크로 말한 것만 (키보드 입력은 빼요)
  function speakingStats() {
    const voice = record.current.utterances.filter((u) => u.mode === 'voice');
    return {
      utterance_count: baseRef.current.utterances + voice.length,
      speaking_ms: baseRef.current.speakingMs + voice.reduce((sum, u) => sum + (u.durationMs || 0), 0),
    };
  }

  // 단계가 바뀔 때마다 지금까지의 기록을 저장
  function persist(lastStage, extra = {}) {
    const logs = logsRef.current;
    updateSession(sessionIdRef.current, {
      last_stage: lastStage,
      memo: memoRef.current,
      turns: logs,
      hint_count: logs.reduce((sum, l) => sum + l.hintsUsed, 0),
      retry_count: retryRef.current.count,
      ...speakingStats(),
      ...extra,
    });
  }

  // 지금 질문의 도움 사용 기록 (도움은 처음부터 보여주지 않으니 받은 단계 수 그대로)
  function recordHints(turn, shown) {
    const log = logsRef.current.find((l) => l.id === turn.id);
    if (!log) return;
    if (shown > log.hintsUsed && !log.helpShownAt) log.helpShownAt = new Date().toISOString(); // 처음 도움을 받은 시점
    log.hintsUsed = Math.max(log.hintsUsed, shown);
  }

  // "다시 하기" 세션인지 (같은 Step을 이미 완료한 적이 있으면 true) — 칼럼 없이 기록으로 알아내요
  const isReplayRef = useRef(false);

  // 들어올 때: 끝내지 않은 지난 세션이 있으면 이어할지 물어보고(또는 바로 이어하고), 없으면 새로 시작
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      isReplayRef.current = await hasCompletedStep(scene.id);
      if (startMode === 'replay') {
        // 다시 하기: 이전 기록은 그대로 두고 새 세션
        sessionIdRef.current = await createSession(scene.id);
        setPhase('prep');
        return;
      }
      const existing = await findUnfinishedSession(scene.id);
      if (existing && hasProgress(existing)) {
        if (startMode === 'resume') {
          resumeSession(existing);
        } else {
          setPendingSession(existing);
          setPhase('resume');
        }
        return;
      }
      // 아무것도 안 한 빈 세션이면 그대로 다시 써요
      sessionIdRef.current = existing?.id ?? (await createSession(scene.id));
      setPhase('prep');
    })();
    // 들어올 때 한 번만 실행해요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  const runRef = useRef(0); // 나가기·다시 시작 시 진행 중이던 순서를 멈추는 번호
  const msgId = useRef(0);
  const chatEnd = useRef(null);
  const rateRef = useRef(rate);
  useEffect(() => {
    rateRef.current = rate; // 다음 대사부터 바뀐 속도로 읽어요
  }, [rate]);

  // 화면에 들어온 시간 기록 + 떠날 때 음성 멈추기
  useEffect(() => {
    record.current.startedAt ??= Date.now();
    return () => {
      runRef.current += 1;
      stopSpeaking();
    };
  }, []);

  // 준비 단계에 있는 동안 영상들을 미리 받아 둬요
  useEffect(() => {
    ['idle', 'talk', 'check', 'pass', 'smile'].forEach((k) => scene.media[k] && fetch(scene.media[k]).catch(() => {}));
  }, [scene]);

  // 새 말풍선·힌트가 생기거나, 메모·입력창이 열려 대화 칸이 좁아지면 맨 아래로 스크롤
  useEffect(() => {
    const chat = chatEnd.current?.parentElement;
    if (chat) chat.scrollTop = chat.scrollHeight;
  }, [messages, hintsShown, busy, finished, turnIndex, memoOpen, typing, notice, draft]);

  const addMessage = (msg) => setMessages((list) => [...list, { id: ++msgId.current, ...msg }]);
  const isStale = (run) => runRef.current !== run;

  // 심사관이 말하기: 말풍선 + 영상 아래 자막 + 음성 + 말하는 영상 → 끝나면 쉬는 영상
  // video: 말하는 동안 영상 (기본 talk, 마지막 인사는 smile) / rest: 다 말한 뒤 영상 (기본 idle)
  async function officerSay(run, line, extra = {}, { video = 'talk', rest = 'idle' } = {}) {
    addMessage({ from: 'officer', text: line, ...extra });
    setCaption(line);
    setOfficer(video);
    setBusy('speaking');
    await speak(line, { rate: rateRef.current });
    if (isStale(run)) return;
    setOfficer(rest);
    setBusy(null);
  }

  // 질문하기
  async function ask(run, index) {
    const turn = turns[index];
    setTurnIndex(index);
    setAttempts(0);
    setHintsShown(0); // 도움은 처음부터 보여주지 않아요 — 먼저 스스로 말해 보기
    setNotice('');
    setDraft(null);
    await officerSay(run, turn.question, { surprise: turn.level === 'surprise' });
  }

  // 대화 시작 (이어하기면 fromIndex 질문부터)
  function startTalk(fromIndex = 0) {
    const run = ++runRef.current;
    record.current.talkStartedAt ??= Date.now();
    setMessages([]);
    setCaption('');
    setDraft(null);
    setStamped(false);
    setFinished(false);
    setPhase('talk');
    persist('talk');
    ask(run, fromIndex);
  }

  // 질문 기록에서 미션 체크 상태 만들기
  function missionsFromLogs(logs) {
    const m = {};
    logs.forEach((l) => {
      if (isPassed(l)) m[l.id] = 'pass';
      else if (l.attempts.length >= scene.maxAttempts) m[l.id] = 'done';
    });
    return m;
  }

  // 이어하기: 메모·기록을 되살리고 멈춘 곳의 다음부터
  function resumeSession(row) {
    sessionIdRef.current = row.id;
    const saved = Array.isArray(row.turns) ? row.turns : [];
    logsRef.current = turns.map((t) => {
      const s = saved.find((x) => x.id === t.id);
      return { id: t.id, level: t.level, attempts: s?.attempts ?? [], hintsUsed: s?.hintsUsed ?? 0, helpShownAt: s?.helpShownAt ?? null };
    });
    baseRef.current = { utterances: row.utterance_count ?? 0, speakingMs: row.speaking_ms ?? 0 };
    retryRef.current = { count: row.retry_count ?? 0, texts: [], success: false };
    setMemo(row.memo ?? '');
    memoRef.current = row.memo ?? '';
    setMissions(missionsFromLogs(logsRef.current));
    setPendingSession(null);

    if (row.last_stage === 'prep') {
      setPhase('prep');
      return;
    }
    const next = logsRef.current.findIndex((l) => !isTurnDone(l, scene.maxAttempts));
    if (next === -1) openCoaching(); // 질문은 다 끝났어요 → 코칭부터
    else startTalk(next);
  }

  // 처음부터: 새 세션
  async function startOver() {
    runRef.current += 1;
    stopSpeaking();
    mic.cancel();
    setPendingSession(null);
    setPhase('loading');
    logsRef.current = emptyLogs(turns);
    baseRef.current = { utterances: 0, speakingMs: 0 };
    retryRef.current = { count: 0, texts: [], success: false };
    record.current = { sceneId: scene.id, startedAt: Date.now(), talkStartedAt: null, finishedAt: null, utterances: [] };
    setMemo('');
    memoRef.current = '';
    setMissions({});
    setMessages([]);
    setCaption('');
    setDraft(null);
    setCoaching(null);
    setAchievement(null);
    setOfficer('idle');
    setBusy(null);
    isReplayRef.current = await hasCompletedStep(scene.id);
    sessionIdRef.current = await createSession(scene.id);
    setPhase('prep');
  }

  // 오늘의 코칭 열기
  async function openCoaching() {
    runRef.current += 1;
    stopSpeaking();
    setCoaching(await buildCoaching(scene, logsRef.current));
    setPhase('coaching');
    persist('coaching');
  }

  // 재도전 한 번
  function handleRetryAttempt({ text: said, mode, durationMs, success }) {
    if (mode === 'voice') logUtterance({ phase: 'retry', mode, text: said, durationMs });
    retryRef.current.count += 1;
    retryRef.current.texts.push(said);
    if (success) retryRef.current.success = true;
    persist('retry');
  }

  // 오늘의 성취 (completed_at 저장)
  function openAchievement() {
    const logs = logsRef.current;
    const improveModel = coaching?.improve?.model;

    // 오늘 새로 말한 표현: 통과한 질문에서 내가 한 말(모범 문장에 가깝게 말했으면 모범 문장) + 재도전 성공 문장
    const expressions = [];
    logs.forEach((l) => {
      const said = l.attempts.find((a) => a.passed)?.text;
      if (!said) return;
      const model = turns.find((t) => t.id === l.id)?.model;
      expressions.push(model && isCloseEnough(model, said, 0.7) ? model : said);
    });
    if (retryRef.current.success && improveModel) expressions.push(improveModel);
    const unique = [...new Set(expressions.map((e) => e.trim()))].filter(Boolean);

    // 오늘 말한 문장 (대화 + 재도전)
    const sentences = [...logs.flatMap((l) => l.attempts.map((a) => a.text)), ...retryRef.current.texts];

    setAchievement({
      missions: turns.map((t) => {
        const log = logs.find((l) => l.id === t.id);
        return { id: t.id, label: t.missionLabel, done: Boolean(log && isTurnDone(log, scene.maxAttempts)) };
      }),
      expressions: unique,
      sentenceCount: sentences.length,
      longestWords: sentences.reduce((max, s) => Math.max(max, wordCount(s)), 0),
    });
    setPhase('achievement');
    persist('achievement', { completed_at: new Date().toISOString(), new_expressions: unique });
    onCompleted?.();
  }

  async function goNext(run, index) {
    if (index + 1 < turns.length) await ask(run, index + 1);
    else await approve(run);
  }

  // 통과: 도장 영상 → 도장 쾅 → 마지막 말
  async function approve(run) {
    setPhase('done');
    setBusy('passing');
    setOfficer('pass');
    await wait(STAMP_DELAY_MS);
    if (isStale(run)) return;
    setStamped(true);
    await wait(1200);
    if (isStale(run)) return;
    // 마지막 인사는 웃으며 말하고, 다 말한 뒤에도 웃는 얼굴 그대로 (smile 영상이 없으면 talk/idle)
    const smile = scene.media.smile ? 'smile' : null;
    await officerSay(run, scene.closing, {}, { video: smile ?? 'talk', rest: smile ?? 'idle' });
    if (isStale(run)) return;
    record.current.finishedAt = Date.now();
    setFinished(true);
    persist('approved');
  }

  // 대답 판단 (말하기·키보드 공통)
  async function submitAnswer(answer) {
    if (busy || phase !== 'talk') return;
    const run = runRef.current;
    const turn = turns[turnIndex];
    setNotice('');
    addMessage({ from: 'me', text: answer });

    // 심사관이 서류를 보며 확인 (최소 0.8초)
    setOfficer('check');
    setBusy('checking');
    const [{ pass }] = await Promise.all([judgeAnswer(turn, answer), wait(MIN_CHECK_MS)]);
    if (isStale(run)) return;

    // 질문별 기록에 이번 시도 추가
    const log = logsRef.current.find((l) => l.id === turn.id);
    log?.attempts.push({ text: answer, passed: pass });

    if (pass) {
      setMissions((m) => ({ ...m, [turn.id]: 'pass' }));
      persist(`turn:${turn.id}`);
      await goNext(run, turnIndex);
      return;
    }

    const tries = attempts + 1;
    setAttempts(tries);
    if (tries >= scene.maxAttempts) {
      // 세 번 시도해도 안 되면 실패 없이 자연스럽게 다음 질문으로
      setMissions((m) => ({ ...m, [turn.id]: 'done' }));
      persist(`turn:${turn.id}`);
      await officerSay(run, scene.moveOnLine);
      if (isStale(run)) return;
      await goNext(run, turnIndex);
    } else {
      const shown = Math.min(maxHelp(turn), hintsShown + 1); // 통과 못 했을 때만 다음 단계 도움
      setHintsShown(shown);
      recordHints(turn, shown);
      await officerSay(run, scene.repeatLine);
      if (isStale(run)) return;
      setCaption(turn.question); // 자막은 다시 지금 질문으로
    }
  }

  // 큰 마이크 버튼: 누르면 듣기 시작, 다시 누르면 끝 (말하다 멈춰도 자동으로 끊지 않아요)
  async function toggleMic() {
    if (mic.listening) {
      const result = await mic.stop();
      const turn = turns[turnIndex];
      logUtterance({ phase: 'talk', turnId: turn.id, mode: 'voice', text: result.text, durationMs: result.durationMs, confidence: result.confidence });
      if (isUnclear(result)) {
        setNotice(UNCLEAR_MSG); // 시도 횟수에 넣지 않아요
        return;
      }
      // 바로 보내지 않고 "이렇게 들렸어요"로 보여줘요 → 고쳐서 보내거나, 다시 말하기
      const heard = result.text.trim();
      setDraft({ text: heard, original: heard });
      return;
    }
    if (busy) return;
    setNotice('');
    setDraft(null);
    mic.start();
  }

  // 들린 문장이 틀렸을 때: 지우고 처음부터 다시 말하기 (시도 횟수에 넣지 않아요)
  // 말하는 중에도, 말을 끝낸 뒤 확인 화면에서도 쓸 수 있어요
  function speakAgain() {
    if (busy) return;
    const heard = mic.listening ? mic.interim : draft?.original ?? '';
    logUtterance({ phase: 'talk', turnId: turns[turnIndex].id, mode: 'redo', text: heard });
    if (mic.listening) mic.cancel(); // 지금까지 들은 건 버려요
    setDraft(null);
    setNotice('');
    // 마이크가 완전히 꺼진 뒤 다시 켜요
    setTimeout(() => mic.start(), 150);
  }

  // 키보드 버튼
  // - 말하는 중이면: 녹음을 멈추고, 지금까지 들린 문장을 그대로 입력칸으로 옮겨 바로 고칠 수 있게
  // - 아니면: 키보드 입력칸 열기/닫기
  async function handleKeyboard() {
    if (mic.listening) {
      const result = await mic.stop();
      logUtterance({ phase: 'talk', turnId: turns[turnIndex].id, mode: 'voice', text: result.text, durationMs: result.durationMs, confidence: result.confidence });
      const heard = result.text.trim();
      setNotice('');
      setDraft({ text: heard, original: heard, focus: true });
      return;
    }
    setTyping((v) => !v);
  }

  // 확인한(필요하면 고친) 문장 보내기
  function sendDraft(e) {
    e?.preventDefault();
    const answer = draft?.text.trim();
    if (!answer || busy) return;
    if (answer !== draft.original) {
      // 키보드로 고친 기록 (발화 횟수·시간 통계에는 들어가지 않아요)
      logUtterance({ phase: 'talk', turnId: turns[turnIndex].id, mode: 'edit', original: draft.original, text: answer });
    }
    setDraft(null);
    submitAnswer(answer);
  }

  function sendText(e) {
    e.preventDefault();
    const answer = text.trim();
    if (!answer || busy) return;
    logUtterance({ phase: 'talk', turnId: turns[turnIndex].id, mode: 'text', text: answer });
    setText('');
    submitAnswer(answer);
  }

  function showNextHint() {
    const turn = turns[turnIndex];
    const shown = Math.min(maxHelp(turn), hintsShown + 1);
    setHintsShown(shown);
    recordHints(turn, shown);
  }

  function exit() {
    setDraft(null);
    runRef.current += 1;
    stopSpeaking();
    mic.cancel();
    onExit?.();
  }

  /* ───────── 불러오는 중 / 이어하기 ───────── */
  if (phase === 'loading' || phase === 'resume') {
    return (
      <div className="im-ready">
        <button type="button" className="im-exit" onClick={exit}>
          나가기
        </button>
        <div className="im-ready-inner im-resume">
          <img className="im-ready-poster" src={scene.media.poster} alt="입국 심사관" />
          <p className="im-eyebrow">{scene.chapterLabel}</p>
          <h1 className="im-title">{scene.title}</h1>
          {phase === 'loading' ? (
            <p className="im-situation">불러오는 중…</p>
          ) : (
            <>
              <p className="im-situation">지난번에 멈춘 곳부터 이어할까요?</p>
              <button type="button" className="im-start" onClick={() => resumeSession(pendingSession)}>
                이어하기
              </button>
              <button type="button" className="im-start im-start--ghost" onClick={startOver}>
                처음부터
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ───────── 오늘의 코칭 + 재도전 ───────── */
  if (phase === 'coaching' && coaching) {
    return (
      <CoachingView
        scene={scene}
        coaching={coaching}
        rate={rate}
        onRateChange={setRate}
        onAttempt={handleRetryAttempt}
        onFinish={openAchievement}
        onExit={exit}
      />
    );
  }

  /* ───────── 오늘의 성취 ───────── */
  if (phase === 'achievement' && achievement) {
    return (
      <AchievementView
        scene={scene}
        {...achievement}
        rate={rate}
        onNext={onNext}
        onRestart={startOver}
        onExit={exit}
      />
    );
  }

  /* ───────── 1) 준비 단계 ───────── */
  if (phase === 'prep') {
    return (
      <ImmigrationPrep
        scene={scene}
        memo={memo}
        onMemoChange={setMemo}
        rate={rate}
        onLog={logUtterance}
        onStart={startTalk}
        onExit={exit}
      />
    );
  }

  /* ───────── 2) 대화 단계 / 3) 통과 ───────── */
  const turn = turns[turnIndex];
  const micDisabled = Boolean(busy) || phase !== 'talk';
  const waitingForMe = phase === 'talk' && !busy; // 지금 내가 대답할 차례

  return (
    <div className="im-room">
      <div className="im-stage">
        <OfficerVideo media={scene.media} state={officer}>
          {caption && (phase === 'talk' || phase === 'done') && (
            <p className="im-caption" aria-hidden="true">
              {caption}
            </p>
          )}
          {stamped && (
            <div className="im-stamp" role="img" aria-label="입국 승인 도장">
              <strong>APPROVED</strong>
              <small>ENTRY PERMITTED</small>
            </div>
          )}
        </OfficerVideo>
        <button type="button" className="im-exit" onClick={exit}>
          나가기
        </button>
      </div>

      {/* 통과 미션 체크리스트 */}
      <div className="im-missions">
        <ul>
          {turns.map((t, i) => {
            const status = missions[t.id];
            const isCurrent = phase === 'talk' && i === turnIndex && !status;
            return (
              <li
                key={t.id}
                className={`im-mission${status ? ` is-${status}` : ''}${isCurrent ? ' is-current' : ''}`}
              >
                <span className="im-mission-icon" aria-hidden="true">
                  {status ? '✓' : i + 1}
                </span>
                {t.missionLabel}
              </li>
            );
          })}
        </ul>
      </div>

      {/* 대화 (심사관 말풍선 = 자막) */}
      <div className="im-chat" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`im-msg im-msg--${m.from}`}>
            {m.surprise && (
              <div className="im-surprise">
                <p className="im-surprise-title">예상 못 한 질문!</p>
                <p className="im-surprise-calm">천천히 해도 괜찮아요.</p>
              </div>
            )}
            <p className="im-bubble">{m.text}</p>
          </div>
        ))}

        {busy === 'checking' && <p className="im-checking">심사관이 확인 중…</p>}

        {/* 레벨별 도움 (내 차례일 때) */}
        {phase === 'talk' && busy !== 'checking' && (
          <TurnHelp turn={turn} hintsShown={hintsShown} rate={rate} disabled={mic.listening} />
        )}
        <div ref={chatEnd} />
      </div>

      {/* 하단 조작부 */}
      {phase === 'talk' && (
        <div className="im-controls">
          {voiceOff && <p className="im-voice-help">{VOICE_HELP}</p>}

          {draft ? (
            /* 말한 뒤: 들린 문장 확인 → 고쳐서 보내기 / 다시 말하기 */
            <form className="im-draft" onSubmit={sendDraft}>
              <label className="im-draft-label" htmlFor="im-draft-text">
                이렇게 들렸어요 · 틀린 부분은 직접 고칠 수 있어요
              </label>
              <textarea
                id="im-draft-text"
                className="im-draft-text"
                lang="en"
                rows={2}
                autoComplete="off"
                autoCapitalize="sentences"
                spellCheck={false}
                autoFocus={Boolean(draft.focus)}
                onFocus={(e) => {
                  const end = e.target.value.length; // 커서를 문장 끝으로
                  e.target.setSelectionRange(end, end);
                }}
                placeholder="영어로 대답을 적어 보세요"
                value={draft.text}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) sendDraft(e);
                }}
              />
              <div className="im-draft-actions">
                <button type="button" className="im-draft-again" onClick={speakAgain} disabled={Boolean(busy)}>
                  🎤 다시 말하기
                </button>
                <button type="submit" className="im-draft-send" disabled={Boolean(busy) || !draft.text.trim()}>
                  보내기
                </button>
              </div>
            </form>
          ) : (
          <>
          {/* 인식 중인 글자 / 안내 */}
          <p className={`im-live${mic.listening ? ' is-listening' : ''}`} aria-live="polite">
            {mic.listening
              ? mic.interim || '듣고 있어요… 다 말했으면 마이크를 다시 눌러 주세요 (키보드를 누르면 바로 고칠 수 있어요)'
              : notice ||
                (busy === 'speaking'
                  ? '심사관의 말을 들어 보세요'
                  : waitingForMe && hintsShown === 0 && turn.level !== 'repeat'
                    ? TRY_FIRST_MSG
                    : waitingForMe && !voiceOff
                      ? '마이크를 누르고 대답해 보세요'
                      : '')}
          </p>

          {showTextInput && (
            <form className="im-form" onSubmit={sendText}>
              <input
                className="im-input"
                type="text"
                lang="en"
                autoComplete="off"
                autoCapitalize="sentences"
                placeholder="영어로 대답해 보세요"
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="영어로 대답 입력"
              />
              <button type="submit" className="im-send" disabled={!waitingForMe || !text.trim()}>
                보내기
              </button>
            </form>
          )}

          <div className="im-buttons">
            <button
              type="button"
              className="im-side-btn"
              onClick={showNextHint}
              disabled={hintsShown >= maxHelp(turn) || mic.listening || Boolean(busy)}
            >
              💡<span>도움 받기</span>
            </button>

            {!voiceOff ? (
              <button
                type="button"
                className={`im-mic${mic.listening ? ' is-listening' : ''}`}
                onClick={toggleMic}
                disabled={micDisabled && !mic.listening}
                aria-label={mic.listening ? '말하기 끝내기' : '말하기 시작'}
              >
                {mic.listening ? '■' : '🎤'}
              </button>
            ) : (
              <span className="im-mic-placeholder" />
            )}

            <div className="im-side-group">
              {mic.listening && (
                <button type="button" className="im-side-btn" onClick={speakAgain} aria-label="처음부터 다시 말하기">
                  ↺<span>다시 말하기</span>
                </button>
              )}
              {!voiceOff ? (
                <button
                  type="button"
                  className={`im-side-btn${typing ? ' is-on' : ''}`}
                  onClick={handleKeyboard}
                  aria-pressed={typing}
                  aria-label={mic.listening ? '말한 문장을 키보드로 고치기' : '키보드로 입력'}
                >
                  ⌨️<span>키보드</span>
                </button>
              ) : (
                <span className="im-side-btn im-side-btn--empty" />
              )}
            </div>
          </div>
          </>
          )}

          <div className="im-footer">
            {memo.trim() ? (
              <button type="button" className="im-memo-toggle" onClick={() => setMemoOpen((v) => !v)}>
                내 메모 {memoOpen ? '▴' : '▾'}
              </button>
            ) : (
              <span />
            )}
            <div className="im-rate" role="group" aria-label="말하기 속도">
              {[0.8, 1].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={rate === r ? 'is-on' : ''}
                  onClick={() => setRate(r)}
                  aria-pressed={rate === r}
                >
                  {r}x
                </button>
              ))}
            </div>
          </div>
          {memoOpen && memo.trim() && <p className="im-memo-view">{memo}</p>}
        </div>
      )}

      {/* 통과 후 */}
      {phase === 'done' && finished && (
        <div className="im-passed">
          <div className="im-pass-card">
            <p className="im-pass-title">입국 심사 통과! 🛂</p>
            <button type="button" className="im-next" onClick={openCoaching}>
              오늘의 코칭 보기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 질문 레벨별 도움 — 먼저 스스로 말해 보고, 도움은 받을 때만 나와요
 * - repeat: 따라 말할 문장 카드 (첫 성공 경험이라 처음부터 보여줌)
 * - choice: 도움을 받으면 선택지 3개
 * - hint·free·surprise: 도움을 받을 때마다 힌트 한 단계씩 (완성된 모범 문장은 보여주지 않아요)
 */
function TurnHelp({ turn, hintsShown, rate, disabled }) {
  const hints = turn.level === 'choice' || turn.level === 'repeat' ? [] : turn.hints.slice(0, hintsShown);
  return (
    <>
      {turn.level === 'repeat' && (
        <div className="im-help-card">
          <p className="im-help-label">이렇게 말해 보세요</p>
          <div className="im-help-row">
            <p className="im-help-sentence">{turn.model}</p>
            <button
              type="button"
              className="im-round im-round--sm"
              onClick={() => speak(turn.model, { rate })}
              disabled={disabled}
              aria-label={`듣기: ${turn.model}`}
            >
              🔊
            </button>
          </div>
        </div>
      )}

      {turn.level === 'choice' && hintsShown > 0 && (
        <div className="im-help-card">
          <p className="im-help-label">이 중 하나를 골라 소리 내어 말해 보세요</p>
          <ul className="im-choices">
            {turn.choices.map((c) => (
              <li key={c} className="im-help-row">
                <p className="im-help-sentence">{c}</p>
                <button
                  type="button"
                  className="im-round im-round--sm"
                  onClick={() => speak(c, { rate })}
                  disabled={disabled}
                  aria-label={`듣기: ${c}`}
                >
                  🔊
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hints.map((h, i) => (
        <div key={i} className="im-hint">
          <span className="im-hint-label">
            💡 힌트 {i + 1} · {HINT_NAMES[i]}
          </span>
          {h}
        </div>
      ))}
    </>
  );
}
