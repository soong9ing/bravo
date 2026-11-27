// ═══════════════════════════════════════════════════════════════
// 여행 진행 상태 계산 — step_sessions 기록으로부터
//   Step: completed(끝낸 적 있음) / inProgress(가장 최근 세션이 아직 진행 중)
//   Day : done(모든 Step 완료) / current(진행 중) / locked(앞날을 다 끝내야 열림)
// ═══════════════════════════════════════════════════════════════

/** 이어할 만한 내용이 있는 세션인지 (준비 화면에 들어가기만 한 빈 세션은 아님) */
export const hasProgress = (row) =>
  row.last_stage !== 'prep' || Boolean(row.memo?.trim()) || Boolean(row.turns?.length);

/**
 * "다시 하기" 세션인지: 같은 Step을 이 세션보다 먼저 완료한 적이 있으면 다시 하기예요.
 * (칼럼을 따로 두지 않고 기록으로 알아내요)
 */
export function isReplaySession(session, allSessions) {
  return allSessions.some(
    (s) => s.step_id === session.step_id && s.completed_at && s.completed_at < session.started_at
  );
}

/**
 * @param journey  src/data/journey.js
 * @param sessions 내 step_sessions 행들
 */
export function computeProgress(journey, sessions) {
  // Step별 상태
  const steps = {};
  for (const day of journey.days) {
    for (const step of day.steps) {
      const mine = sessions.filter((s) => s.step_id === step.id);
      const completedTimes = mine.map((s) => s.completed_at).filter(Boolean).sort();
      const latest = mine.at(-1); // started_at 순서로 받아요 → 마지막이 가장 최근
      steps[step.id] = {
        completed: completedTimes.length > 0,
        lastCompletedAt: completedTimes.at(-1) ?? null,
        // 가장 최근 세션이 끝나지 않았고, 실제로 뭔가 했으면 "진행 중"
        inProgress: Boolean(latest && !latest.completed_at && hasProgress(latest)),
      };
    }
  }

  // Day별 상태
  const days = {};
  let previousDone = true;
  let currentDay = null;
  for (const day of journey.days) {
    const unlocked = previousDone;
    const done = day.steps.length > 0 && day.steps.every((s) => steps[s.id].completed);
    const status = !unlocked ? 'locked' : done ? 'done' : 'current';
    if (status === 'current' && currentDay === null) currentDay = day.day;
    days[day.day] = { status };
    previousDone = done;
  }

  // 각 날의 "다음 차례" Step: 그날 처음으로 아직 끝내지 않은 Step
  for (const day of journey.days) {
    const next = day.steps.find((s) => !steps[s.id].completed);
    days[day.day].nextStepId = days[day.day].status === 'current' ? next?.id ?? null : null;
  }

  // "여행 이어가기": 진행 중인 Step이 있으면 그것, 없으면 지금 날의 다음 차례 Step (만들어진 것만)
  let continueTarget = null;
  for (const day of journey.days) {
    if (days[day.day].status === 'locked') break;
    const resumable = day.steps.find((s) => s.available && steps[s.id].inProgress);
    if (resumable) {
      continueTarget = { day: day.day, stepId: resumable.id, mode: 'resume' };
      break;
    }
  }
  if (!continueTarget && currentDay !== null) {
    const day = journey.days.find((d) => d.day === currentDay);
    const next = day.steps.find((s) => s.id === days[currentDay].nextStepId);
    if (next?.available) continueTarget = { day: currentDay, stepId: next.id, mode: 'start' };
  }

  return { steps, days, currentDay: currentDay ?? journey.days.at(-1).day, continueTarget };
}
