import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import './BoardingPassSignup.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ nickname, email, password }) {
  const errors = {};
  const nick = nickname.trim();
  if (!nick) errors.nickname = '닉네임을 입력해 주세요.';
  else if (nick.length < 2 || nick.length > 12) errors.nickname = '닉네임은 2~12자로 입력해 주세요.';

  if (!email.trim()) errors.email = '이메일을 입력해 주세요.';
  else if (!EMAIL_RE.test(email.trim())) errors.email = '이메일 형식이 올바르지 않아요.';

  if (!password) errors.password = '비밀번호를 입력해 주세요.';
  else if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    errors.password = '영문과 숫자를 포함해 8자 이상으로 만들어 주세요.';

  return errors;
}

// Supabase 영어 에러 메시지를 한국어로
function toKoreanError(message = '') {
  if (/already registered|already exists/i.test(message)) return '이미 탑승권이 있는 이메일이에요. 로그인해 주세요.';
  if (/rate limit/i.test(message)) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
  if (/password/i.test(message)) return '비밀번호가 조건에 맞지 않아요.';
  return '탑승권 발급 중 문제가 생겼어요. 다시 시도해 주세요.';
}

function formatDate(d) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]}`;
}

/**
 * 프롤로그: 항공권 형태의 회원가입 화면
 * @param onComplete(user) 탑승권 발급 후 "탑승하기"를 누르면 호출 → 이륙 애니메이션으로 이동
 * @param onLogin()        "이미 탑승권이 있나요?" 클릭 시 호출 → 로그인 화면으로 이동
 */
export default function BoardingPassSignup({ onComplete, onLogin }) {
  const [form, setForm] = useState({ nickname: '', email: '', password: '' });
  const [touched, setTouched] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | issued | confirmEmail
  const [serverError, setServerError] = useState('');
  const [user, setUser] = useState(null);

  // 좌석 번호는 화면에 들어올 때 한 번만 랜덤 배정
  const seat = useMemo(
    () => `${Math.floor(Math.random() * 30) + 10}${'ABCDEF'[Math.floor(Math.random() * 6)]}`,
    []
  );
  const today = useMemo(() => formatDate(new Date()), []);

  const errors = validate(form);
  const showError = (key) => touched[key] && errors[key];
  const locked = status !== 'idle';

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const blur = (key) => () => setTouched((t) => ({ ...t, [key]: true }));

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ nickname: true, email: true, password: true });
    if (Object.keys(errors).length > 0) return;

    setStatus('loading');
    setServerError('');

    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        // 닉네임은 DB 트리거가 profiles 테이블로 옮겨요 (supabase/profiles.sql 참고)
        data: { nickname: form.nickname.trim() },
        // 인증 메일 링크를 누르면 가입했던 주소(로컬 또는 배포 주소)로 돌아와요
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setServerError(toKoreanError(error.message));
      setStatus('idle');
      return;
    }

    setUser(data.user);
    // 이메일 인증을 켜 두면 session이 비어 있어요 → 인증 안내를 보여줌
    setStatus(data.session ? 'issued' : 'confirmEmail');
  }

  const passengerName = form.nickname.trim().toUpperCase() || 'YOUR NAME';

  return (
    <div className="bp-screen">
      <header className="bp-intro">
        <p className="bp-intro-eyebrow">PROLOGUE</p>
        <h1>모든 여행에는 시작이 있어요</h1>
        <p className="bp-intro-sub">탑승권을 발급받고 첫 번째 여행을 떠나 볼까요?</p>
      </header>

      <form className={`bp-ticket ${status === 'issued' ? 'is-issued' : ''}`} onSubmit={handleSubmit} noValidate>
        <div className="bp-main">
        {/* ── 항공사 헤더 ── */}
        <div className="bp-head">
          <span className="bp-brand">BraVo AIRLINES</span>
          <span className="bp-class">BOARDING PASS</span>
        </div>

        {/* ── 출발/도착 ── */}
        <div className="bp-route">
          <div className="bp-city">
            <span className="bp-code">ICN</span>
            <span className="bp-cityname">SEOUL</span>
          </div>
          <div className="bp-flightline" aria-hidden="true">
            <span className="bp-plane">✈</span>
          </div>
          <div className="bp-city bp-city--right">
            <span className="bp-code">SFO</span>
            <span className="bp-cityname">SAN FRANCISCO</span>
          </div>
        </div>

        <dl className="bp-meta">
          <div><dt>FLIGHT</dt><dd>BV 001</dd></div>
          <div><dt>DATE</dt><dd>{today}</dd></div>
          <div><dt>GATE</dt><dd>07</dd></div>
          <div><dt>SEAT</dt><dd>{seat}</dd></div>
        </dl>

        {/* ── 입력 영역 ── */}
        <div className="bp-body">
          <div className="bp-field">
            <label htmlFor="bp-nickname">
              PASSENGER NAME <span>닉네임</span>
            </label>
            <input
              id="bp-nickname"
              type="text"
              autoComplete="nickname"
              placeholder="여행에서 불릴 이름"
              maxLength={12}
              value={form.nickname}
              onChange={update('nickname')}
              onBlur={blur('nickname')}
              disabled={locked}
              aria-invalid={!!showError('nickname')}
            />
            {showError('nickname') && <p className="bp-error">{errors.nickname}</p>}
          </div>

          <div className="bp-field">
            <label htmlFor="bp-email">
              E-MAIL <span>이메일</span>
            </label>
            <input
              id="bp-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="traveler@email.com"
              value={form.email}
              onChange={update('email')}
              onBlur={blur('email')}
              disabled={locked}
              aria-invalid={!!showError('email')}
            />
            {showError('email') && <p className="bp-error">{errors.email}</p>}
          </div>

          <div className="bp-field">
            <label htmlFor="bp-password">
              PASSWORD <span>비밀번호</span>
            </label>
            <div className="bp-pw">
              <input
                id="bp-password"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="영문+숫자 8자 이상"
                value={form.password}
                onChange={update('password')}
                onBlur={blur('password')}
                disabled={locked}
                aria-invalid={!!showError('password')}
              />
              <button
                type="button"
                className="bp-pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                {showPw ? '숨기기' : '보기'}
              </button>
            </div>
            {showError('password') && <p className="bp-error">{errors.password}</p>}
          </div>
        </div>

        </div>

        {/* ── 절취선 아래(스텁) ── */}
        <div className="bp-stub">
          <div className="bp-stub-row">
            <div>
              <span className="bp-stub-label">PASSENGER</span>
              <span className="bp-stub-name">{passengerName}</span>
            </div>
            <div className="bp-barcode" aria-hidden="true" />
          </div>

          {serverError && <p className="bp-error bp-error--server">{serverError}</p>}

          {status === 'idle' || status === 'loading' ? (
            <button type="submit" className="bp-submit" disabled={status === 'loading'}>
              {status === 'loading' ? '탑승권 발급 중…' : '탑승권 발급하기'}
            </button>
          ) : status === 'issued' ? (
            <button type="button" className="bp-submit bp-submit--board" onClick={() => onComplete?.(user)}>
              탑승하기 ✈
            </button>
          ) : (
            <>
              <p className="bp-confirm">
                <strong>{form.email}</strong>로 인증 메일을 보냈어요.
                <br />메일의 링크를 누르면 탑승이 시작돼요!
              </p>
              <p className="bp-hint">메일이 안 보이면 스팸함도 확인해 주세요.</p>
            </>
          )}

          {status === 'idle' && (
            <button type="button" className="bp-login" onClick={onLogin}>
              이미 탑승권이 있나요? <u>로그인</u>
            </button>
          )}
        </div>

        {(status === 'issued' || status === 'confirmEmail') && (
          <div className="bp-stamp" aria-live="polite">
            ISSUED<small>발급 완료</small>
          </div>
        )}
      </form>
    </div>
  );
}
