import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { env } from '../../config/env'
import { Button, MaterialIcon, Input } from '../../components/common'
import { IconHealthCheck } from '../../components/icons/SidebarIcons'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Validate redirect path to prevent open redirect attacks
  const rawFrom = (location.state as { from?: string })?.from
  const from = rawFrom && rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/'

  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)

  // Check if first-run setup is needed
  useEffect(() => {
    fetch(`${env.apiBaseUrl}/auth/setup/status`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setNeedsSetup(json.data.needs_setup)
      })
      .catch(() => setError('서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.'))
  }, [])

  // 렌더 중에 navigate()를 부르면 렌더 단계 부작용이라 내비게이션 루프를 만들 수 있다.
  // 리다이렉트를 렌더 결과로 표현하는 것이 react-router가 의도한 방식이다.
  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const endpoint = needsSetup ? '/auth/setup' : '/auth/login'

    try {
      const res = await fetch(`${env.apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      const json = await res.json()
      if (json.success) {
        login(json.data)
        navigate(from, { replace: true })
      } else {
        setError(json.error?.message || '오류가 발생했습니다')
        setLoading(false)
      }
    } catch {
      setError('서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.')
      setLoading(false)
    }
  }

  // Still loading setup status
  if (needsSetup === null && !error) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <MaterialIcon size={36} name="progress_activity" className="text-primary animate-spin" />
      </div>
    )
  }

  const isSetup = needsSetup === true

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
      <div>
        {/* Logo / Title */}
        <div className="text-center mb-8 w-[26rem] max-w-full">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <IconHealthCheck size={24} className="text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary tracking-tight mb-1">EveryUp</div>
          <h1 className="type-section-title text-text-base">
            {isSetup ? '초기 설정' : '로그인'}
          </h1>
          <p className="type-body text-text-muted mt-1">
            {isSetup ? '관리자 계정을 생성하세요' : '관리자 계정으로 로그인하세요'}
          </p>
        </div>

        {/* Login card */}
        <div className="w-[26rem] max-w-full">
          {/* relative wrapper — height equals card only, anchor for recovery panel */}
          <div className="relative">
            <div className="bg-bg-surface border border-ui-border rounded-xl shadow-sm p-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2 text-red-500 dark:text-red-400 type-body bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                  <span className="w-4 h-5 shrink-0 inline-flex items-center justify-center">
                    <MaterialIcon size={20} name="error_outline" className="leading-none" />
                  </span>
                  <span>{error}</span>
                </div>
              )}

              {isSetup && (
                <div className="flex items-start gap-2 text-sky-600 dark:text-sky-400 type-body bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2.5">
                  <span className="w-4 h-5 shrink-0 inline-flex items-center justify-center">
                    <MaterialIcon size={20} name="info" className="leading-none" />
                  </span>
                  <span>처음 실행되었습니다. 관리자 계정을 설정하세요.</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="login-username" className="block text-sm font-medium text-text-muted uppercase tracking-wide mb-1.5">사용자 이름</label>
                  <Input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(''); }}
                    required
                    autoFocus
                    invalid={!!error}
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="block text-sm font-medium text-text-muted uppercase tracking-wide mb-1.5">
                    비밀번호{isSetup && ' (최소 8자 이상)'}
                  </label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    required
                    invalid={!!error}
                    placeholder={isSetup ? '최소 8자 이상' : '비밀번호'}
                  />
                </div>
                {!isSetup && (
                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={() => setShowForgot(!showForgot)}
                      className="type-body text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                    >
                      계정 정보를 잊으셨나요?
                    </button>
                  </div>
                )}
                <Button type="submit" size="lg" disabled={loading} className="w-full mt-2">
                  {loading && <MaterialIcon size={20} name="progress_activity" className="animate-spin" />}
                  {loading ? '처리 중...' : isSetup ? '계정 생성' : '로그인'}
                </Button>
              </form>
            </div>

            {/* Recovery panel — outside card div, bottom-aligned with card border */}
            {!isSetup && showForgot && (
              <div className="animate-slide-in-right absolute bottom-0 left-full ml-4 w-[26rem] bg-bg-surface border border-ui-border rounded-xl shadow-sm p-5 space-y-4">
                <p className="type-label text-text-secondary">
                  계정 정보를 잊으셨나요?
                </p>
                <p className="type-body text-text-muted">
                  셀프 호스팅 환경에서는 아래 방법으로 계정을 재설정할 수 있습니다.
                </p>

                {/* Method 1: Env var */}
                <div className="space-y-1.5">
                  <p className="type-label text-text-secondary">
                    방법 1: 환경 변수로 임시 접근 후 초기화 (권장)
                  </p>
                  <p className="type-body text-text-muted">
                    환경 변수로 임시 계정을 만들어 로그인한 뒤, 설정 → 계정 초기화에서 계정을 새로 생성하세요.
                  </p>
                  <div className="space-y-1">
                    <p className="type-body text-text-muted">① 환경 변수 설정 후 재시작</p>
                    <pre className="text-xs bg-bg-main border border-ui-border rounded-lg p-2.5 overflow-x-auto text-text-secondary leading-relaxed">
{`# docker-compose.yml
environment:
  EVERYUP_ADMIN_USERNAME: admin
  EVERYUP_ADMIN_PASSWORD: newpassword

docker compose restart`}
                    </pre>
                  </div>
                  <p className="type-body text-text-muted">② 위 계정 정보로 로그인</p>
                  <p className="type-body text-text-muted">③ 설정 → 계정 초기화 → 새 계정 생성</p>
                </div>

                {/* Method 2: Remove data volume */}
                <div className="space-y-1.5">
                  <p className="type-label text-text-secondary">
                    방법 2: 계정 데이터 삭제 후 초기화
                  </p>
                  <p className="type-body text-text-muted">
                    데이터 볼륨을 제거하고 재시작하면 초기 설정 화면으로 돌아갑니다. 모니터링 데이터는 유지됩니다.
                  </p>
                  <pre className="text-xs bg-bg-main border border-ui-border rounded-lg p-2.5 overflow-x-auto text-text-secondary leading-relaxed">
{`# 컨테이너 중지 후 데이터 볼륨 삭제
docker compose down
docker volume rm everyup-data

# 재시작 — 초기 설정 화면으로 돌아옴
docker compose up -d`}
                  </pre>
                </div>

                {/* GitHub README link */}
                <a
                  href="https://github.com/ai-turn/everyup#readme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 type-body text-text-dim hover:text-primary dark:hover:text-primary transition-colors"
                >
                  <MaterialIcon size={20} name="open_in_new" />
                  GitHub README
                </a>
              </div>
            )}
          </div>{/* end relative wrapper */}

          <p className="text-center type-body text-text-dim mt-4">
            이 계정으로 모니터링 시스템에 접근합니다
          </p>
        </div>
      </div>
    </div>
  )
}
