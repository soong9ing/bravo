// ═══════════════════════════════════════════════════════════════
// 학습 기록 저장 — Supabase public.step_sessions 테이블
// 저장이 실패해도 학습은 멈추지 않아요 (콘솔에만 기록).
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase';

const TABLE = 'step_sessions';

const logError = (what, error) => console.error(`[step_sessions] ${what} 실패:`, error?.message ?? error);

/** 아직 끝내지 않은(completed_at이 비어 있는) 가장 최근 세션 */
export async function findUnfinishedSession(stepId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('step_id', stepId)
    .is('completed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) logError('불러오기', error);
  return data ?? null;
}

/** 새 세션 만들기 → id (실패하면 null) */
export async function createSession(stepId) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      step_id: stepId,
      started_at: new Date().toISOString(),
      last_stage: 'prep',
      memo: '',
      turns: [],
      new_expressions: [],
      hint_count: 0,
      retry_count: 0,
      utterance_count: 0,
      speaking_ms: 0,
    })
    .select('id')
    .single();
  if (error) {
    logError('만들기', error);
    return null;
  }
  return data.id;
}

/** 세션 고치기 */
export async function updateSession(id, patch) {
  if (!id) return;
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
  if (error) logError('저장', error);
}

/** 내 모든 세션 (여행 달력의 진행 상태 계산용, 오래된 것부터) */
export async function listMySessions() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, step_id, started_at, completed_at, last_stage, memo, turns')
    .order('started_at', { ascending: true });
  if (error) logError('목록 불러오기', error);
  return data ?? [];
}

/** 이 단계를 끝낸 적이 있는지 (있으면 지금 시작하는 세션은 "다시 하기") */
export async function hasCompletedStep(stepId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id')
    .eq('step_id', stepId)
    .not('completed_at', 'is', null)
    .limit(1);
  if (error) logError('완료 확인', error);
  return Boolean(data?.length);
}
