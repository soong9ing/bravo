import BoardingPassSignup from './components/BoardingPassSignup'

function App() {
  return (
    <BoardingPassSignup
      onComplete={() => alert('이륙!')}
      onLogin={() => alert('로그인 화면')}
    />
  )
}

export default App
