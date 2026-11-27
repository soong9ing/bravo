// 프롤로그 애니메이션에 쓰는 이미지 4장 (public/prologue 폴더)
const base = import.meta.env.BASE_URL;

export const PROLOGUE_IMAGES = {
  plane: `${base}prologue/plane.webp`,
  takeoff: `${base}prologue/takeoff-bg.webp`,
  flight: `${base}prologue/flight-bg.webp`,
  landing: `${base}prologue/landing-bg.webp`,
};

let loading = null;

// 인터넷이 느려도 이 시간이 지나면 기다리지 않고 시작해요
const MAX_WAIT_MS = 4000;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve; // 실패해도 멈추지 않고 계속 진행
    img.src = src;
  });
}

/**
 * 이미지 4장을 미리 불러와요. 여러 번 불러도 한 번만 다운로드해요.
 */
export function preloadPrologueImages() {
  if (!loading) {
    loading = Promise.race([
      Promise.all(Object.values(PROLOGUE_IMAGES).map(loadImage)),
      new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS)),
    ]);
  }
  return loading;
}
