import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import BoardingPassSignup from './components/BoardingPassSignup'
import BoardingPassLogin from './components/BoardingPassLogin'

function App() {
  // undefined = 아직 확인 중, null = 로그인 안 됨, 객체 = 로그인됨
  const [session, setSession] = useState(undefined)
  // 로그인 안 됐을 때 보여줄 화면: 'signup'(가입) 또는 'login'(로그인)
  const [screen, setScreen] = useState('signup')

  useEffect(() => {
    // 로그인 상태가 바뀔 때마다(처음 열 때, 인증 메일로 돌아올 때, 로그아웃할 때) 알려 줘요
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    // 화면을 떠날 때 감지를 멈춰요
    return () => data.subscription.unsubscribe()
  }, [])

  // 확인 중일 때는 잠깐 아무것도 안 보여줘요 (가입 화면이 깜빡이지 않게)
  if (session === undefined) return null

  // 로그아웃하면 로그인 화면이 나오게
  async function handleLogout() {
    setScreen('login')
    await supabase.auth.signOut()
  }

  if (session) {
    const nickname = session.user.user_metadata?.nickname ?? '여행자'
    return (
      <div style={styles.screen}>
        <p style={styles.eyebrow}>BOARDING</p>
        <h1 style={styles.title}>탑승 준비 완료 ✈</h1>
        <p>{nickname}님, 곧 첫 번째 여행이 시작돼요!</p>
        <button style={styles.button} onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    )
  }

  // 로그인 안 된 상태: 가입 화면 ↔ 로그인 화면
  if (screen === 'login') {
    return <BoardingPassLogin onSignup={() => setScreen('signup')} />
  }

  return (
    <BoardingPassSignup
      onComplete={() => alert('이륙!')}
      onLogin={() => setScreen('login')}
    />
  )
}

// 임시 화면용 간단한 스타일
const styles = {
  screen: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    background: 'linear-gradient(180deg, #0b1d3a 0%, #1f4275 55%, #f2a971 100%)',
    color: '#fff',
    fontFamily: "'Pretendard', -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
    textAlign: 'center',
    padding: 16,
  },
  eyebrow: { margin: 0, fontSize: 11, letterSpacing: '0.3em', opacity: 0.7 },
  title: { margin: 0, fontSize: 26, fontWeight: 800 },
  button: {
    marginTop: 12,
    padding: '10px 20px',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: 999,
    background: 'transparent',
    color: '#fff',
    cursor: 'pointer',
  },
}

export default App
