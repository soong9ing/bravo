import { useEffect, useRef } from 'react';

// 반복 재생하는 상태와 1번만 재생하는 상태
const LOOPING = ['idle', 'talk', 'smile'];
const STATES = ['idle', 'talk', 'check', 'pass', 'smile'];

/**
 * 심사관 영상: 5개를 미리 불러 겹쳐 놓고, 보이는 것만 바꿔요 (약 80ms 페이드)
 * @param media  { poster, idle, talk, check, pass, smile } 영상 경로
 * @param state  'idle' | 'talk' | 'check' | 'pass' | 'smile'
 * @param children 영상 위에 겹쳐 보여줄 것 (예: 도장)
 */
export default function OfficerVideo({ media, state, children }) {
  const refs = useRef({});

  useEffect(() => {
    STATES.forEach((name) => {
      const video = refs.current[name];
      if (!video) return;

      if (name === state) {
        // 1번만 재생하는 영상(check, pass)과 말하기 영상은 처음부터
        if (name !== 'idle') video.currentTime = 0;
        video.play().catch(() => {}); // 자동 재생이 막혀도 멈추지 않게
      } else if (name !== 'idle') {
        // 대기 영상은 뒤에서 계속 돌려 두고, 나머지는 쉬게 해요
        video.pause();
      }
    });
  }, [state]);

  return (
    <div className="im-video">
      {STATES.filter((name) => media[name]).map((name) => (
        <video
          key={name}
          ref={(el) => {
            refs.current[name] = el;
          }}
          className={`im-video-layer${name === state ? ' is-active' : ''}`}
          src={media[name]}
          poster={media.poster}
          preload="auto"
          muted
          playsInline
          loop={LOOPING.includes(name)}
          autoPlay={name === 'idle'}
          aria-hidden="true"
        />
      ))}
      {children}
    </div>
  );
}
