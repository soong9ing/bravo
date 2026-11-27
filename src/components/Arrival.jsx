import './Arrival.css';

/**
 * 도착 화면 (샌프란시스코 DAY 1)
 * @param nickname   화면에 보여줄 닉네임
 * @param onNext()   "입국 심사대로 가기" 클릭 시 호출
 * @param onLogout() "로그아웃" 클릭 시 호출
 */
export default function Arrival({ nickname, onNext, onLogout }) {
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
        <button type="button" className="arr-button" onClick={onNext}>
          입국 심사대로 가기
        </button>
      </div>
    </div>
  );
}

/** 임시 화면: 입국 심사 (준비 중) */
export function ImmigrationComingSoon({ onBack, onLogout }) {
  return (
    <div className="arr-screen">
      <button type="button" className="arr-logout" onClick={onLogout}>
        로그아웃
      </button>

      <div className="arr-content">
        <p className="arr-eyebrow">IMMIGRATION</p>
        <h1 className="arr-title">입국 심사 (준비 중)</h1>
        <p className="arr-sub">곧 이곳에서 첫 영어 대화가 시작돼요.</p>
        <button type="button" className="arr-button arr-button--ghost" onClick={onBack}>
          ← 도착 화면으로
        </button>
      </div>
    </div>
  );
}
