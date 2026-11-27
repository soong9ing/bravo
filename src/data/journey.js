// ═══════════════════════════════════════════════════════════════
// 7일 여행 구조
// - 하루(day) 안에 여러 Step이 순서대로 있어요.
// - available: false 인 Step은 아직 만들지 않은 "준비 중" Step이에요.
// - 그날의 Step을 모두 끝내야 다음 날이 열려요.
// ═══════════════════════════════════════════════════════════════

const journey = {
  city: '샌프란시스코',
  // title: 영어 제목 / titleKo: 달력에 보이는 한국어 제목 (스토리라인 기준)
  days: [
    {
      day: 1,
      title: 'Welcome to San Francisco!',
      titleKo: '샌프란시스코에 오신 것을 환영합니다!',
      steps: [
        { id: 'ch1_step1_immigration', title: '입국 심사', available: true },
        { id: 'ch1_step2_baggage', title: '수하물 찾기', available: false },
        { id: 'ch1_step3_taxi', title: '택시 타기', available: false },
        { id: 'ch1_step4_hotel', title: '호텔 체크인', available: false },
        { id: 'ch1_step5_room', title: '나의 첫 호텔', available: false },
      ],
    },
    { day: 2, title: 'A Taste of the City', titleKo: '맛있는 도시 탐험', steps: [] },
    { day: 3, title: 'Lost in the City', titleKo: '길을 잃어도 괜찮아', steps: [] },
    { day: 4, title: 'A New Friend', titleKo: '새로운 친구', steps: [] },
    { day: 5, title: 'Shopping Adventures', titleKo: '여행의 기념품', steps: [] },
    { day: 6, title: 'An Unexpected Day', titleKo: '예상하지 못한 하루', steps: [] },
    { day: 7, title: 'Until We Meet Again', titleKo: '마지막이자 새로운 시작', steps: [] },
  ],
};

export default journey;
