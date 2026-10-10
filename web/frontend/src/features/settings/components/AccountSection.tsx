import { useAuth } from '../../../contexts/AuthContext';
import { SectionCard } from './SectionCard';

// Signed-in account summary (ver2 settings: 계정 · 인증). Info-only — there is
// no password-change endpoint yet.
export function AccountSection() {

  const { user } = useAuth();

  if (!user) return null;

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <SectionCard title="계정 · 인증" subtitle="로그인 계정과 세션 정보">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-ui-active flex items-center justify-center text-sm text-text-secondary shrink-0">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-label text-text-base truncate">{user.username}</p>
          <p className="text-xs text-text-dim mt-0.5">
            역할 {user.role} · 세션 JWT 7일 · 로컬 비밀번호
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
