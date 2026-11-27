import { useCallback, useEffect, useRef, useState } from 'react';
import { createListener, isRecognitionSupported } from '../lib/speech';

/**
 * 마이크 하나를 화면에서 쓰기 쉽게 감싼 도구
 * - start(): 듣기 시작
 * - stop():  학습자가 끝냈을 때 → { text, confidence, durationMs }
 * - interim: 인식 중인 글자 (실시간)
 * - error:   'denied'(권한 거부) | 'unavailable'(마이크 없음) | 'failed' | null
 */
export default function useSpeechInput() {
  const supported = isRecognitionSupported();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const listenerRef = useRef(null);
  const startedAt = useRef(0);

  const start = useCallback(() => {
    if (!supported) return false;
    listenerRef.current?.abort();
    setInterim('');
    try {
      listenerRef.current = createListener({
        onInterim: setInterim,
        onError: (code) => {
          setError(code);
          setListening(false);
          setInterim('');
        },
      });
      listenerRef.current.start();
    } catch {
      setError('failed');
      return false;
    }
    startedAt.current = Date.now();
    setListening(true);
    return true;
  }, [supported]);

  const stop = useCallback(async () => {
    const listener = listenerRef.current;
    listenerRef.current = null;
    const durationMs = Date.now() - startedAt.current; // 마이크를 켜 둔 시간
    setListening(false);
    if (!listener) return { text: '', confidence: null, durationMs };
    const result = await listener.stop();
    setInterim('');
    return { ...result, durationMs };
  }, []);

  const cancel = useCallback(() => {
    listenerRef.current?.abort();
    listenerRef.current = null;
    setListening(false);
    setInterim('');
  }, []);

  // 화면을 떠나면 마이크도 끄기
  useEffect(() => () => listenerRef.current?.abort(), []);

  return { supported, listening, interim, error, start, stop, cancel };
}
