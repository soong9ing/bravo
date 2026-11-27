import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { preloadPrologueImages } from './lib/prologueAssets'
import BoardingPassSignup from './components/BoardingPassSignup'
import BoardingPassLogin from './components/BoardingPassLogin'
import FlightPrologue from './components/FlightPrologue'
import Arrival, { ImmigrationComingSoon } from './components/Arrival'

function App() {
  // undefined = 아직 확인 중, null = 로그인 안 됨, 객체 = 로그인됨
  const [session, setSession] = useState(undefined)
  // 로그인 안 됐을 때 보여줄 화면: 'signup'(가입) 또는 'login'(로그인)
  const [screen, setScreen] = useState('signup')
  // 로그인한 사람의 정보와 지금 단계
  // stage: 'ready'(탑승 준비 완료) | 'flight'(비행 애니메이션) | 'arrival'(도착) | 'immigration'(입국 심사)
  const [traveler, setTraveler] = useState(null) // { userId, profile, stage }

  useEffect(() => {
    // 로그인 상태가 바뀔 때마다(처음 열 때, 인증 메일로 돌아올 때, 로그아웃할 때) 알려 줘요
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    // 화면을 떠날 때 감지를 멈춰요
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  // 로그인하면 profiles 테이블에서 닉네임과 프롤로그를 본 시간을 가져와요
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('nickname, prologue_seen_at')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('프로필을 불러오지 못했어요:', error.message)
        // 프롤로그를 이미 봤으면 바로 도착 화면, 아니면 탑승 준비 완료 화면
        setTraveler({ userId, profile: data, stage: data?.prologue_seen_at ? 'arrival' : 'ready' })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // "탑승 준비 완료" 화면에 있는 동안 프롤로그 이미지 4장을 미리 불러와 둬요
  // (로그인 안 했으면 traveler가 비어 있으니, 있는지 먼저 확인해요)
  const stage = traveler && traveler.userId === userId ? traveler.stage : null
  useEffect(() => {
    if (stage === 'ready') preloadPrologueImages()
  }, [stage])

  const setStage = (stage) => setTraveler((t) => ({ ...t, stage }))

  // 비행이 끝나거나 건너뛰면: 도착 화면으로 + 프롤로그 본 시간을 저장
  function goToArrival() {
    setStage('arrival')
    if (traveler?.profile?.prologue_seen_at) return // 이미 저장돼 있으면 그대로 둬요
    supabase
      .from('profiles')
      .update({ prologue_seen_at: new Date().toISOString() })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) console.error('prologue_seen_at 저장 실패:', error.message)
      })
  }

  // 로그아웃하면 로그인 화면이 나오게
  async function handleLogout() {
    setScreen('login')
    await supabase.auth.signOut()
  }

  // 확인 중일 때는 잠깐 아무것도 안 보여줘요 (가입 화면이 깜빡이지 않게)
  if (session === undefined) return null

  if (session) {
    // 프로필을 아직 불러오는 중이면 하늘 배경만 잠깐 보여줘요
    if (traveler?.userId !== userId) return <div style={styles.screen} />

    const nickname = traveler.profile?.nickname ?? session.user.user_metadata?.nickname ?? '여행자'

    if (traveler.stage === 'flight') return <FlightPrologue onFinish={goToArrival} />
    if (traveler.stage === 'arrival')
      return <Arrival nickname={nickname} onNext={() => setStage('immigration')} onLogout={handleLogout} />
    if (traveler.stage === 'immigration')
      return <ImmigrationComingSoon onBack={() => setStage('arrival')} onLogout={handleLogout} />

    // 'ready': 탑승 준비 완료
    return (
      <div style={styles.screen}>
        <p style={styles.eyebrow}>BOARDING</p>
        <h1 style={styles.title}>탑승 준비 완료 ✈</h1>
        <p>{nickname}님, 곧 첫 번째 여행이 시작돼요!</p>
        <button style={styles.boardButton} onClick={() => setStage('flight')}>
          탑승하기 ✈
        </button>
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
  boardButton: {
    marginTop: 20,
    padding: '14px 32px',
    border: 'none',
    borderRadius: 999,
    background: '#e8553d',
    color: '#fff',
    fontSize: 16,
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(5, 15, 35, 0.35)',
  },
  button: {
    marginTop: 4,
    padding: '8px 18px',
    border: '1px solid rgba(255,255,255,0.6)',
    borderRadius: 999,
    background: 'transparent',
    color: '#fff',
    fontSize: 13,
    cursor: 'pointer',
  },
}

export default App
