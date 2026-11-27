import { useState } from 'react';
import { supabase } from '../lib/supabase';
import './BoardingPassSignup.css'; // 가입 화면과 같은 탑승권 디자인을 그대로 써요

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = '이메일을 입력해 주세요.';
  else if (!EMAIL_RE.test(email.trim())) errors.email = '이메일 형식이 올바르지 않아요.';
  if (!password) errors.password = '비밀번호를 입력해 주세요.';
  return errors;
}

// Supabase 영어 에러 메시지를 한국어로
function toKoreanError(message = '') {
  if (/invalid login credentials/i.test(message)) return '이메일 또는 비밀번호가 맞지 않아요.';
  if (/email not confirmed/i.test(message))
    return '이메일 인증이 아직 안 됐어요. 메일함(스팸함 포함)을 확인해 주세요.';
  return '체크인 중 문제가 생겼어요. 다시 시도해 주세요.';
}

function formatDate(d) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]}`;
}

/**
 * 체크인(로그인) 화면
 * 로그인에 성공하면 App.jsx가 로그인 상태를 감지해서 "탑승 준비 완료" 화면으로 바꿔 줘요.
 * @param onSignup() "탑승권이 없나요? 가입하기" 클릭 시 호출 → 가입 화면으로 이동
 */
export default function BoardingPassLogin({ onSignup }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false); // 이메일 인증이 안 된 경우
  const [resendStatus, setResendStatus] = useState('idle'); // idle | sending | sent | error

  // 좌석 번호와 날짜는 화면에 들어올 때 한 번만 정해요
  const [seat] = useState(
    () => `${Math.floor(Math.random() * 30) + 10}${'ABCDEF'[Math.floor(Math.random() * 6)]}`
  );
  const [today] = useState(() => formatDate(new Date()));

  const errors = validate(form);
  const showError = (key) => touched[key] && errors[key];

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const blur = (key) => () => setTouched((t) => ({ ...t, [key]: true }));

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setServerError('');
    setNeedsConfirm(false);
    setResendStatus('idle');

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });

    setLoading(false);
    if (error) {
      setServerError(toKoreanError(error.message));
      setNeedsConfirm(/email not confirmed/i.test(error.message));
    }
    // 성공하면 따로 할 일이 없어요 → App.jsx가 알아서 다음 화면으로 넘겨 줘요
  }

  async function handleResend() {
    setResendStatus('sending');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: form.email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setResendStatus(error ? 'error' : 'sent');
  }

  // 티켓 아래쪽 승객 이름: 이메일 @ 앞부분을 대문자로
  const passengerName = form.email.trim().split('@')[0].toUpperCase() || 'TRAVELER';

  return (
    <div className="bp-screen">
      <header className="bp-intro">
        <p className="bp-intro-eyebrow">CHECK-IN</p>
        <h1>다시 여행을 이어가요</h1>
        <p className="bp-intro-sub">탑승권 정보를 입력해 주세요</p>
      </header>

      <form className="bp-ticket" onSubmit={handleSubmit} noValidate>
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
              <label htmlFor="bp-login-email">
                E-MAIL <span>이메일</span>
              </label>
              <input
                id="bp-login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="traveler@email.com"
                value={form.email}
                onChange={update('email')}
                onBlur={blur('email')}
                disabled={loading}
                aria-invalid={!!showError('email')}
              />
              {showError('email') && <p className="bp-error">{errors.email}</p>}
            </div>

            <div className="bp-field">
              <label htmlFor="bp-login-password">
                PASSWORD <span>비밀번호</span>
              </label>
              <div className="bp-pw">
                <input
                  id="bp-login-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="비밀번호"
                  value={form.password}
                  onChange={update('password')}
                  onBlur={blur('password')}
                  disabled={loading}
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

          {/* 이메일 인증이 안 된 경우에만: 인증 메일 다시 보내기 */}
          {needsConfirm && (
            resendStatus === 'sent' ? (
              <div style={{ marginBottom: 12 }}>
                <p className="bp-confirm">인증 메일을 다시 보냈어요!</p>
                <p className="bp-hint">메일이 안 보이면 스팸함도 확인해 주세요.</p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="bp-login"
                  style={{ margin: '0 0 12px' }}
                  onClick={handleResend}
                  disabled={resendStatus === 'sending'}
                >
                  <u>{resendStatus === 'sending' ? '보내는 중…' : '인증 메일 다시 보내기'}</u>
                </button>
                {resendStatus === 'error' && (
                  <p className="bp-error bp-error--server">
                    메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.
                  </p>
                )}
              </>
            )
          )}

          <button type="submit" className="bp-submit" disabled={loading}>
            {loading ? '체크인 중…' : '체크인하기'}
          </button>

          <button type="button" className="bp-login" onClick={onSignup}>
            탑승권이 없나요? <u>가입하기</u>
          </button>
        </div>
      </form>
    </div>
  );
}
