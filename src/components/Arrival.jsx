import './Arrival.css';

/**
 * 도착 화면 (샌프란시스코 DAY 1)
 * @param nickname   화면에 보여줄 닉네임
 * @param immigrationDone 입국 심사를 끝냈는지 ("입국 심사 완료 ✓" 표시)
 * @param onNext()   "입국 심사대로 가기" 클릭 시 호출
 * @param onLogout() "로그아웃" 클릭 시 호출
 */
export default function Arrival({ nickname, immigrationDone, onNext, onLogout }) {
  return (
    <div className="arr-screen">
      <div className="arr-sun" aria-hidden="true" />
      <button type="button" className="arr-logout" onClick={onLogout}>
        로그아웃
      </button>

      <div className="arr-content">
        <p className="arr-eyebrow">DAY 1</p>
        <h1 className="arr-title">Welcome to San Francisco!</h1>
        <p className="arr-sub">{nickname}님, 첫 번째 여행이 시작됐어요.</p>
        {immigrationDone && <p className="arr-done">입국 심사 완료 ✓</p>}
        <button type="button" className="arr-button" onClick={onNext}>
          {immigrationDone ? '입국 심사 다시 해 보기' : '입국 심사대로 가기'}
        </button>
      </div>
    </div>
  );
}

/** 임시 화면: 아직 만들지 않은 단계 (준비 중) */
export function ComingSoon({ eyebrow, title, sub, backLabel = '← 돌아가기', onBack, onLogout }) {
  return (
    <div className="arr-screen">
      <button type="button" className="arr-logout" onClick={onLogout}>
        로그아웃
      </button>

      <div className="arr-content">
        <p className="arr-eyebrow">{eyebrow}</p>
        <h1 className="arr-title">{title}</h1>
        {sub && <p className="arr-sub">{sub}</p>}
        <button type="button" className="arr-button arr-button--ghost" onClick={onBack}>
          {backLabel}
        </button>
      </div>
    </div>
  );
}
