// ═══════════════════════════════════════════════════════════════
// Chapter 1 · Step 1 · 입국 심사 — 장면 데이터
//
// 화면 코드(Immigration.jsx)와 분리된 "내용"만 있는 파일이에요.
// 다른 장면도 이 형식 그대로 새 파일을 만들면 돼요.
//
// ▸ level (질문마다 한 단계씩 어려워져요)
//   repeat   : 듣고 따라 말하기 (모범 문장을 보여줌 — 첫 성공 경험)
//   choice   : 먼저 스스로 말해 보고, 도움을 받으면 선택지 3개가 나타남
//   hint     : 먼저 스스로 말해 보고, 도움을 받으면 힌트가 한 단계씩
//   free     : 먼저 스스로 말해 보고, 도움을 받으면 힌트가 한 단계씩
//   surprise : 예상 못 한 질문 (반드시 마지막)
//
// ▸ 도움은 처음부터 보여주지 않아요. "도움 받기"를 누르거나 한 번 통과하지 못했을 때만 나와요.
// ▸ hints: [방향, 단어, 문장 틀] — 도움을 받을 때마다 한 단계씩
//
// ▸ keywords (통과 판단 규칙)
//   anyOf: [...]          → 이 단어 중 하나라도 있으면 통과
//   allOf: [[...], [...]] → 각 묶음에서 하나씩 모두 있으면 통과
//   '#number'             → 숫자(7, 1,000 등)
//   복수형(-s)과 4글자 이상 단어의 변형(visiting 등)도 알아서 인정해요.
// ═══════════════════════════════════════════════════════════════

const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

const scene = {
  id: 'ch1_step1_immigration',
  chapterLabel: 'CHAPTER 1 · STEP 1',
  title: '입국 심사',
  situation: '긴 비행 끝에 샌프란시스코에 도착했어요. 입국 심사관의 질문에 영어로 대답해 보세요.',

  // 심사관 영상 (public 폴더 기준 경로, 960x720)
  media: {
    poster: '/scenes/immigration/officer-poster.jpg',
    idle: '/scenes/immigration/officer-idle.mp4', // 대기 (계속 반복)
    talk: '/scenes/immigration/officer-talk.mp4', // 말하기 (말하는 동안 반복)
    check: '/scenes/immigration/officer-check.mp4', // 서류 확인 (1번)
    pass: '/scenes/immigration/officer-pass.mp4', // 도장 찍기 (1번)
    smile: '/scenes/immigration/officer-smile.mp4', // 웃으며 말하기 (통과 후 마지막 인사, 반복)
  },

  // 준비 단계: 핵심 표현
  keyExpressions: [
    { en: "I'm here for vacation.", ko: '휴가차 왔어요.' },
    { en: "I'll be staying for a week.", ko: '일주일 동안 머물 거예요.' },
    { en: 'This is my first time visiting the United States.', ko: '미국은 이번이 처음이에요.' },
    { en: "I'll be staying at a hotel downtown.", ko: '시내 호텔에 묵을 거예요.' },
  ],

  // 준비 단계: 할 말 메모 안내
  memoGuide: '심사관에게 할 말을 단어로 적어 보세요. (예: vacation, one week, hotel)',

  // 대화 단계: 질문 5개 (순서대로, 점점 어려워져요)
  turns: [
    {
      id: 'purpose',
      level: 'repeat',
      missionLabel: '방문 목적',
      question: "Good morning. May I see your passport, please? What's the purpose of your visit?",
      model: "I'm here for vacation.",
      keywords: { anyOf: ['vacation', 'holiday', 'sightseeing', 'travel', 'trip'] },
      hints: ['방문 목적을 말해 보세요.', 'vacation · travel · sightseeing', "I'm here for ______."],
    },
    {
      id: 'duration',
      level: 'choice',
      missionLabel: '체류 기간',
      question: 'How long will you be staying?',
      choices: ["I'll be staying for a week.", "I'll be staying for three days.", "I'll be staying for a month."],
      model: "I'll be staying for a week.",
      // 숫자(또는 one~ten, a/an) + day/week/month
      keywords: { allOf: [['#number', ...NUMBER_WORDS, 'a', 'an'], ['day', 'week', 'month']] },
      hints: ['얼마나 머무를지 하나 골라서 말해 보세요.', 'a week · three days · a month', "I'll be staying for ______."],
    },
    {
      id: 'first',
      level: 'hint',
      missionLabel: '첫 방문 여부',
      question: 'Is this your first time in the United States?',
      model: 'Yes, this is my first time visiting the United States.',
      keywords: { anyOf: ['yes', 'no', 'first', 'before'] },
      hints: ['미국에 처음 왔는지 대답해 보세요.', 'first time · visiting', 'Yes, this is my ______ time.'],
    },
    {
      id: 'stay',
      level: 'free',
      missionLabel: '숙소',
      question: 'Where will you be staying?',
      model: "I'll be staying at a hotel in downtown San Francisco.",
      keywords: { anyOf: ['hotel', 'friend', 'airbnb', 'hostel', 'house', 'downtown'] },
      hints: ['어디에서 머무를지 말해 보세요.', "hotel · friend's house · downtown", "I'll be staying at ______."],
    },
    {
      id: 'money',
      level: 'surprise',
      missionLabel: '예상 못 한 질문',
      question: 'And how much money are you bringing for this trip?',
      model: 'I have about 1,000 dollars in cash and a credit card.',
      keywords: { anyOf: ['dollar', 'won', 'cash', 'card', 'money', '#number'] },
      hints: ['가져온 돈이 얼마나 되는지 말해 보세요.', 'dollars · cash · credit card', 'I have about ______ in cash.'],
    },
  ],

  repeatLine: 'Sorry? Could you say that again?', // 통과 못 했을 때
  moveOnLine: 'Okay, thank you.', // 세 번 시도 후 자연스럽게 넘어갈 때
  closing: 'Welcome to the United States. Enjoy your stay!', // 마지막 말

  maxAttempts: 3, // 한 질문에서 시도할 수 있는 횟수 (넘으면 실패 없이 다음 질문)

  // 오늘의 코칭: 질문별 칭찬 문구 (학습자가 실제로 한 말을 인용한 뒤 붙여요)
  praise: {
    purpose: '방문 목적을 묻는 질문에 딱 맞는 대답이었어요.',
    duration: '머무는 기간을 정확하게 전했어요.',
    first: '첫 방문인지 묻는 질문에 분명하게 대답했어요.',
    stay: '숙소를 묻는 질문에 딱 맞는 대답이었어요.',
    money: '예상 못 한 질문에도 당황하지 않고 대답했어요.',
  },

  // 성취 기록의 여권 스탬프
  stamp: { place: 'SFO', day: 'DAY 1', label: '입국 심사' },
};

export default scene;
