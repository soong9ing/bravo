import { useEffect, useRef, useState } from 'react';
import { PROLOGUE_IMAGES, preloadPrologueImages } from '../lib/prologueAssets';
import './FlightPrologue.css';

// 장면 순서와 길이 (총 약 11.5초)
const SCENES = [
  { key: 'takeoff', duration: 3500 }, // 밖에서 본 이륙
  { key: 'cruise', duration: 4000 }, // 창문으로 본 비행
  { key: 'landing', duration: 4000 }, // 밖에서 본 착륙
];

// 장면이 바뀔 때 앞 장면과 겹쳐 보이는 시간 (크로스페이드)
const OVERLAP_MS = 800;

/**
 * 프롤로그 비행 애니메이션
 * @param onFinish() 애니메이션이 끝나거나 "건너뛰기"를 누르면 호출 → 도착 화면으로
 */
export default function FlightPrologue({ onFinish }) {
  const [loaded, setLoaded] = useState(false); // 이미지 4장을 다 불러왔는지
  const [scene, setScene] = useState(0); // 지금 장면
  const [prevScene, setPrevScene] = useState(null); // 사라지는 중인 앞 장면 (겹치는 동안만)

  // onFinish가 바뀌어도 타이머가 다시 시작되지 않도록 최신 값을 따로 보관해요
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  });

  // 이미지를 다 불러온 뒤에 애니메이션을 시작해요 (보통은 이미 미리 불러와 있어요)
  useEffect(() => {
    let cancelled = false;
    preloadPrologueImages().then(() => {
      if (!cancelled) setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 장면마다 정해진 시간이 지나면 다음 장면으로 (마지막 장면 뒤에는 onFinish)
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      if (scene === SCENES.length - 1) {
        onFinishRef.current?.();
      } else {
        setPrevScene(scene); // 앞 장면은 서서히 사라지고
        setScene(scene + 1); // 새 장면은 서서히 나타나요
      }
    }, SCENES[scene].duration);
    return () => clearTimeout(timer);
  }, [scene, loaded]);

  // 겹치는 시간이 지나면 앞 장면을 치워요
  useEffect(() => {
    if (prevScene === null) return;
    const timer = setTimeout(() => setPrevScene(null), OVERLAP_MS);
    return () => clearTimeout(timer);
  }, [prevScene]);

  const current = SCENES[scene].key;
  // 화면에 그릴 장면들: [사라지는 앞 장면(아래), 지금 장면(위)]
  const stages = [
    ...(prevScene !== null ? [{ key: SCENES[prevScene].key, leaving: true }] : []),
    { key: current, leaving: false },
  ];

  return (
    <div className="fp-screen" data-scene={loaded ? current : 'loading'}>
      {/* 화면 전체 배경: 장면에 맞춰 서서히 바뀌어요 (비행 중에는 밤 남색 → 새벽 분홍) */}
      <div className="fp-bg fp-bg--cruise-night" aria-hidden="true" />
      <div className="fp-bg fp-bg--cruise-dawn" aria-hidden="true" />

      {loaded &&
        stages.map(({ key, leaving }) => (
          <div key={key} className={`fp-stage fp-stage--${key}${leaving ? ' is-leaving' : ''}`}>
            {key === 'takeoff' && <TakeoffStage />}
            {key === 'cruise' && <CruiseStage />}
            {key === 'landing' && <LandingStage />}
          </div>
        ))}

      <button type="button" className="fp-skip" onClick={() => onFinish?.()}>
        건너뛰기
      </button>
    </div>
  );
}

/* 문구 + 아래쪽 어두운 그라데이션 (배경 위에서도 잘 읽히게) */
function Caption({ title, sub }) {
  return (
    <>
      <div className="fp-scrim" aria-hidden="true" />
      <p className="fp-caption" role="status">
        <span className="fp-caption-title">{title}</span>
        {sub && <span className="fp-caption-sub">{sub}</span>}
      </p>
    </>
  );
}

/* ═════════ ① 이륙 ═════════ */
function TakeoffStage() {
  return (
    <>
      <img className="fp-bgimg fp-bgimg--takeoff" src={PROLOGUE_IMAGES.takeoff} alt="" draggable="false" />
      <img className="fp-plane fp-plane--takeoff" src={PROLOGUE_IMAGES.plane} alt="" draggable="false" />
      <Caption title="이륙합니다" sub="ICN → SFO" />
    </>
  );
}

/* ═════════ ② 비행 (창문 안) ═════════ */
function CruiseStage() {
  return (
    <>
      {/* 창틀은 고정, 안쪽 하늘 그림만 밤(왼쪽) → 일출(오른쪽)으로 흘러가요 */}
      <div className="fp-window" aria-hidden="true">
        <img className="fp-flightimg" src={PROLOGUE_IMAGES.flight} alt="" draggable="false" />
      </div>
      <Caption title="샌프란시스코까지 약 11시간" />
    </>
  );
}

/* ═════════ ③ 착륙 ═════════ */
function LandingStage() {
  return (
    <>
      <img className="fp-bgimg fp-bgimg--landing" src={PROLOGUE_IMAGES.landing} alt="" draggable="false" />
      <img className="fp-plane fp-plane--landing" src={PROLOGUE_IMAGES.plane} alt="" draggable="false" />
      <Caption title="샌프란시스코에 도착했습니다" />
    </>
  );
}
