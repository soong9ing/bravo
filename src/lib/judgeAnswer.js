// ═══════════════════════════════════════════════════════════════
// 대답 판단 — 지금은 정해진 키워드로만 판단해요.
// 나중에 AI로 판단하게 바꿀 때는 judgeAnswer() 안쪽만 바꾸면 돼요.
// (화면 코드는 { pass: true/false } 결과만 받아서 써요)
// ═══════════════════════════════════════════════════════════════

// 문장을 소문자 단어/숫자 목록으로 쪼개요. "I'll stay 7 days" → ['i', 'll', 'stay', '7', 'days']
export function tokenize(text) {
  return text.toLowerCase().match(/[a-z]+|\d[\d,.]*/g) ?? [];
}

// 단어 하나가 키워드와 맞는지
function matches(token, keyword) {
  if (keyword === '#number') return /\d/.test(token);
  if (token === keyword || token === `${keyword}s` || token === `${keyword}es`) return true;
  // 4글자 이상 키워드는 변형도 인정 (visit → visiting, travel → traveling)
  return keyword.length >= 4 && token.startsWith(keyword);
}

const hasAny = (tokens, keywords) => keywords.some((k) => tokens.some((t) => matches(t, k)));

/**
 * 내 대답이 질문을 통과했는지 판단해요.
 * @param {object} turn   장면 데이터의 질문 하나 (keywords 규칙 포함)
 * @param {string} answer 내가 말하거나 입력한 영어 문장
 * @returns {Promise<{ pass: boolean }>}
 */
export async function judgeAnswer(turn, answer) {
  const tokens = tokenize(answer);
  const { anyOf, allOf } = turn.keywords;

  let pass = false;
  if (anyOf) pass = hasAny(tokens, anyOf);
  if (allOf) pass = allOf.every((group) => hasAny(tokens, group));

  return { pass };
}

/** 대답에 들어 있는 서로 다른 키워드 개수 (코칭에서 "가장 잘 쓴 답"을 고를 때) */
export function countKeywordHits(turn, answer) {
  const tokens = tokenize(answer);
  const { anyOf = [], allOf = [] } = turn.keywords;
  const all = [...new Set([...anyOf, ...allOf.flat()])].filter((k) => !['a', 'an'].includes(k));
  return all.filter((k) => tokens.some((t) => matches(t, k))).length;
}

/** 단어 개수 */
export const wordCount = (text) => tokenize(text).length;

/**
 * 따라 말하기 확인: 목표 문장의 단어 중 threshold(기본 60%) 이상을 말했으면 성공
 * (준비 단계 🎤 는 60%, 재도전은 70%)
 */
export function isCloseEnough(target, spoken, threshold = 0.6) {
  return overlapRatio(target, spoken) >= threshold;
}

/** 목표 문장의 단어 중 몇 %를 말했는지 (0~1) */
export function overlapRatio(target, spoken) {
  const want = tokenize(target);
  const said = new Set(tokenize(spoken));
  if (!want.length) return 0;
  return want.filter((w) => said.has(w)).length / want.length;
}
