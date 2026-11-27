// ═══════════════════════════════════════════════════════════════
// 오늘의 코칭 (비판단적 피드백) — 지금은 규칙으로 만들어요.
// 나중에 AI 피드백으로 바꿀 때는 buildCoaching() 안쪽만 바꾸면 돼요.
//
// 원칙
//  - 점수·정답률·오답 개수는 만들지 않아요.
//  - 잘한 점 1개: 학습자가 실제로 한 말을 그대로 인용해서 구체적으로 칭찬
//  - 다음엔 이렇게 1개: 개선점은 딱 하나만, 사람이 아니라 "표현"의 문제로
// ═══════════════════════════════════════════════════════════════

import { countKeywordHits, wordCount, overlapRatio } from './judgeAnswer.js';

const lastText = (log) => log.attempts.at(-1)?.text ?? '';
const passedText = (log) => log.attempts.find((a) => a.passed)?.text;

// 잘한 점: 통과한 답 중 모범 문장에 가장 가까운(빠진 단어가 적은) 문장 하나
// - 모범 문장과 겹치는 비율을 가장 크게 봐요 → "at hotel"처럼 a가 빠진 문장보다 "at a hotel"을 골라요
// - 따라 말하기·선택형(repeat·choice)은 보고 말한 문장이라 조금 덜 우선해요
function pickPraise(scene, logs) {
  let best = null;
  for (const log of logs) {
    const turn = scene.turns.find((t) => t.id === log.id);
    for (const a of log.attempts) {
      if (!a.passed) continue;
      const words = wordCount(a.text);
      const closeness = overlapRatio(turn.model, a.text); // 0~1
      const copied = turn.level === 'repeat' || turn.level === 'choice';
      const score =
        closeness * 10 + countKeywordHits(turn, a.text) + (words >= 4 ? 2 : 0) - (copied ? 3 : 0);
      if (!best || score > best.score) best = { score, turn, text: a.text, words };
    }
  }
  if (!best) return null;

  const detail =
    best.words >= 4
      ? '문장으로 끝까지 말해서 심사관이 바로 이해할 수 있었어요.'
      : '꼭 필요한 핵심 단어를 정확하게 짚었어요.';
  return {
    turnId: best.turn.id,
    quote: best.text,
    message: `${scene.praise?.[best.turn.id] ?? '질문에 딱 맞는 대답이었어요.'} ${detail}`,
  };
}

// 다음엔 이렇게: 통과 못 함 > 힌트를 많이 씀 > 단어만 말함(3단어 이하) 순으로 하나만
function pickImprovement(scene, logs, praiseTurnId) {
  let pick = null;
  for (const log of logs) {
    const turn = scene.turns.find((t) => t.id === log.id);
    if (!log.attempts.length) continue;
    const passed = passedText(log);
    const short = passed !== undefined && wordCount(passed) <= 3;
    const score = (passed === undefined ? 100 : 0) + log.hintsUsed * 10 + (short ? 5 : 0);
    if (score > 0 && (!pick || score > pick.score)) pick = { score, turn, log, passed, short };
  }

  let message;
  if (pick) {
    if (pick.passed === undefined) {
      message = '이 질문은 표현이 조금 낯설었을 거예요. 이렇게 말하면 심사관이 바로 알아들어요.';
    } else if (pick.log.hintsUsed > 0 && !pick.short) {
      message = '힌트를 보며 끝까지 대답했어요. 이 문장을 통째로 익혀 두면 다음엔 힌트 없이도 말할 수 있어요.';
    } else {
      message = '단어만으로도 뜻은 전해졌어요. 문장으로 이어 말하면 훨씬 자연스럽게 들려요.';
    }
    return {
      turnId: pick.turn.id,
      said: pick.passed ?? lastText(pick.log),
      model: pick.turn.model,
      message,
    };
  }

  // 모두 문장으로 잘 말했을 때: 칭찬한 질문이 아닌 것 중, 내 말이 모범 문장과 가장 다른 질문을 골라
  // 같은 뜻의 다른 표현을 하나 더 익혀요
  let fallback = null;
  for (const log of logs) {
    if (log.id === praiseTurnId || !log.attempts.length) continue;
    const turn = scene.turns.find((t) => t.id === log.id);
    // 정해진 문장을 따라 하거나 고르는 질문(repeat·choice)은 "다른 표현"이 의미 없어서 빼요
    if (turn.level === 'repeat' || turn.level === 'choice') continue;
    const said = passedText(log) ?? lastText(log);
    const ratio = overlapRatio(turn.model, said);
    if (!fallback || ratio < fallback.ratio) fallback = { turn, said, ratio };
  }
  if (!fallback) {
    const turn = scene.turns.find((t) => t.id !== praiseTurnId) ?? scene.turns[0];
    fallback = { turn, said: '', ratio: 0 };
  }
  return {
    turnId: fallback.turn.id,
    said: fallback.said,
    model: fallback.turn.model,
    message:
      fallback.ratio >= 0.9
        ? '이미 이 문장 그대로 잘 말했어요. 이번엔 더 또렷하고 자신 있게 한 번 더 말해 볼까요?'
        : '이미 잘 대답했어요. 같은 뜻을 이렇게도 말할 수 있어요. 표현을 하나 더 늘려 볼까요?',
  };
}

/**
 * 오늘의 코칭 만들기
 * @param scene 장면 데이터
 * @param logs  질문별 기록 [{ id, level, attempts: [{ text, passed }], hintsUsed }]
 * @returns {Promise<{ praise: {turnId, quote, message} | null, improve: {turnId, said, model, message} }>}
 */
export async function buildCoaching(scene, logs) {
  const praise = pickPraise(scene, logs);
  const improve = pickImprovement(scene, logs, praise?.turnId);
  return { praise, improve };
}
