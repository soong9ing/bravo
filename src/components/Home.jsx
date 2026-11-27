import { useCallback, useEffect, useRef, useState } from 'react';
import defaultJourney from '../data/journey';
import { listMySessions } from '../lib/stepSessions';
import { computeProgress } from '../lib/journeyProgress';
import './Home.css';

const shortDate = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
};
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * HOME: 나의 여권 (하루 = 여권 한 면, 세로로 한 장씩 넘기기 · 에피소드를 끝내면 도장)
 * @param nickname
 * @param initialDay 처음 보여줄 날 (없으면 지금 진행 중인 날)
 * @param onOpenStep(stepId, mode) mode: 'start'(시작하기) | 'resume'(이어하기) | 'replay'(다시 하기)
 * @param onLogout()
 */
export default function Home({ journey = defaultJourney, nickname, initialDay, onOpenStep, onLogout }) {
  const [progress, setProgress] = useState(null);
  const [active, setActive] = useState(0); // 지금 보고 있는 장 (0 = DAY 1)
  const scroller = useRef(null);
  const wheelLock = useRef(false);
  const placed = useRef(false);
  const pageCount = journey.days.length;

  // 진행 상태 불러오기
  useEffect(() => {
    let cancelled = false;
    listMySessions().then((sessions) => {
      if (!cancelled) setProgress(computeProgress(journey, sessions));
    });
    return () => {
      cancelled = true;
    };
  }, [journey]);

  // 한 장으로 이동
  const goTo = useCallback(
    (index, smooth = true) => {
      const el = scroller.current;
      if (!el) return;
      const i = Math.max(0, Math.min(pageCount - 1, index));
      el.scrollTo({ top: i * el.clientHeight, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
    },
    [pageCount]
  );

  // 처음 들어오면 진행 중인 날(또는 돌아온 에피소드의 날)에서 시작
  useEffect(() => {
    if (!progress || placed.current) return;
    placed.current = true;
    const day = initialDay ?? progress.currentDay ?? 1;
    const index = Math.max(0, journey.days.findIndex((d) => d.day === day));
    goTo(index, false);
    setActive(index); // 스크롤 알림이 늦게 와도 점·종이 표시가 바로 맞게
  }, [progress, initialDay, journey, goTo]);

  // 스크롤 위치로 지금 장 알아내기
  function handleScroll() {
    const el = scroller.current;
    if (!el) return;
    setActive(Math.round(el.scrollTop / el.clientHeight));
  }

  // 노트북: 마우스 휠 한 번 = 한 장
  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      if (wheelLock.current) return;
      wheelLock.current = true;
      const current = Math.round(el.scrollTop / el.clientHeight);
      goTo(current + (e.deltaY > 0 ? 1 : -1));
      setTimeout(() => {
        wheelLock.current = false;
      }, 650);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [goTo]);

  // 노트북: 방향키 ↑↓ (PageUp/PageDown, 스페이스)도 한 장씩
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      const el = scroller.current;
      if (!el) return;
      const current = Math.round(el.scrollTop / el.clientHeight);
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        goTo(current + 1);
      } else if (['ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        goTo(current - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo]);

  return (
    <div className="hm-root">
      {/* 맨 위 작은 고정 바 */}
      <header className="hm-bar">
        <span className="hm-bar-name">{nickname}님의 여행</span>
        <button type="button" className="hm-bar-logout" onClick={onLogout}>
          로그아웃
        </button>
      </header>

      {/* 달력 7장 (세로로 한 장씩) */}
      <div className="hm-pages" ref={scroller} onScroll={handleScroll}>
        {journey.days.map((day, index) => (
          <PassportPage
            key={day.day}
            day={day}
            progress={progress}
            isActive={index === active}
            onOpenStep={onOpenStep}
            nickname={nickname}
          />
        ))}
      </div>

      {/* 오른쪽 가운데 점 7개 */}
      <nav className="hm-dots" aria-label="날짜 이동">
        {journey.days.map((day, index) => (
          <button
            key={day.day}
            type="button"
            className={`hm-dot${index === active ? ' is-active' : ''}`}
            onClick={() => goTo(index)}
            aria-label={`DAY ${day.day}로 이동`}
            aria-current={index === active ? 'page' : undefined}
          />
        ))}
      </nav>
    </div>
  );
}

/* ═════════ 여권 한 면 (하루 = 한 면, 에피소드를 끝내면 도장) ═════════ */
const KOREAN_ORDINALS = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째'];
const two = (n) => String(n).padStart(2, '0');
const INKS = ['#e8553d', '#1f4275', '#2b8a5e']; // 도장 잉크 색 (주황 · 남색 · 초록 번갈아)
const TILTS = [-8, 6, -4, 9, -6, 4]; // 도장마다 조금씩 다르게 기울이기

// 여권 맨 아래 기계 판독 줄 (예: P<BRAVO<<SOO<<<<<<<<<<<<<<<)
function mrzLine(nickname, day) {
  const name = (nickname || 'TRAVELER').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TRAVELER';
  const first = `P<BRAVO<<${name}`.padEnd(30, '<').slice(0, 30);
  const second = `DAY${two(day)}<SFO<<MYFIRSTJOURNEY`.padEnd(30, '<').slice(0, 30);
  return [first, second];
}

function PassportPage({ day, progress, isActive, onOpenStep, nickname }) {
  const status = progress?.days[day.day]?.status ?? 'loading'; // done | current | locked | loading
  const locked = status === 'locked';
  const nextStepId = progress?.days[day.day]?.nextStepId;
  const [mrz1, mrz2] = mrzLine(nickname, day.day);

  return (
    <section className="hm-page" aria-label={`DAY ${day.day}`}>
      <article className={`hm-pass${isActive ? ' is-active' : ''}${locked ? ' is-locked' : ''}`}>
        {/* 머리: 여권 표시 + 쪽 번호 */}
        <header className="hm-pass-head">
          <span className="hm-pass-brand">BraVo PASSPORT</span>
          <span className="hm-pass-page">P. {two(day.day)}</span>
        </header>

        {/* 날짜 */}
        <div className="hm-pass-day">
          <p className="hm-pass-daynum">
            <small>DAY</small>
            {two(day.day)}
          </p>
          <div className="hm-pass-daytext">
            <p className="hm-pass-dayword">{KOREAN_ORDINALS[day.day - 1] ?? day.day} 날</p>
            <h2 className="hm-pass-title">{day.titleKo ?? day.title}</h2>
          </div>
        </div>

        <p className="hm-pass-label">
          VISAS · STAMPS
          {locked && (
            <span className="hm-pass-lock">
              <span aria-hidden="true">🔒</span> {KOREAN_ORDINALS[day.day - 2] ?? '앞'} 날 도장을 모두 모으면 열려요
            </span>
          )}
        </p>

        {/* 도장 칸: 에피소드 하나 = 한 칸 */}
        {day.steps.length === 0 ? (
          <div className="hm-slots-empty">
            <span aria-hidden="true">✈</span>
            곧 새로운 에피소드가 열려요
          </div>
        ) : (
          <ol className="hm-slots">
            {day.steps.map((step, i) => {
              const s = progress?.steps[step.id];
              let state = 'soon';
              if (step.available && s) {
                if (s.inProgress) state = 'progress';
                else if (s.completed) state = 'done';
                else if (step.id === nextStepId) state = 'next';
                else state = 'wait';
              }
              const disabled = locked || !progress;
              const ink = INKS[i % INKS.length];
              return (
                <li key={step.id} className={`hm-slot is-${state}`}>
                  {state === 'done' ? (
                    <>
                      <div className="hm-stampmark" style={{ '--ink': ink, '--tilt': `${TILTS[i % TILTS.length]}deg` }}>
                        <span className="hm-stampmark-top">EP.{two(i + 1)} · SFO</span>
                        <b className="hm-stampmark-title">{step.title}</b>
                        <span className="hm-stampmark-date">
                          {s.lastCompletedAt ? shortDate(s.lastCompletedAt) : ''} ✓
                        </span>
                      </div>
                      <button type="button" className="hm-slot-again" disabled={disabled} onClick={() => onOpenStep(step.id, 'replay')}>
                        다시 하기
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="hm-slot-num">EP.{two(i + 1)}</span>
                      <span className="hm-slot-title">{step.title}</span>
                      {state === 'progress' && (
                        <button type="button" className="hm-slot-btn" disabled={disabled} onClick={() => onOpenStep(step.id, 'resume')}>
                          이어하기
                        </button>
                      )}
                      {state === 'next' && (
                        <button type="button" className="hm-slot-btn is-next" disabled={disabled} onClick={() => onOpenStep(step.id, 'start')}>
                          시작하기
                        </button>
                      )}
                      {(state === 'soon' || state === 'wait') && <span className="hm-slot-soon">준비 중</span>}
                    </>
                  )}
                </li>
              );
            })}
            {/* 마지막 칸: 그날을 다 끝내면 큰 도장 */}
            <li className={`hm-slot hm-slot--day${status === 'done' ? ' is-done' : ''}`}>
              {status === 'done' ? (
                <div className="hm-daystamp">
                  <span>DAY {two(day.day)}</span>
                  <b>CLEAR</b>
                </div>
              ) : (
                <span className="hm-slot-daywait">
                  DAY {two(day.day)}
                  <br />
                  완주 도장
                </span>
              )}
            </li>
          </ol>
        )}

        {/* 여권 맨 아래 기계 판독 줄 (장식) */}
        <div className="hm-mrz" aria-hidden="true">
          <span>{mrz1}</span>
          <span>{mrz2}</span>
        </div>
      </article>
    </section>
  );
}
