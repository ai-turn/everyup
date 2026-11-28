export const QUICKSTART_URL = 'https://ai-turn.github.io/everyup/guide/quickstart';

/** compact: 마우스 전용 사이드바 — 터치 높이(44px)가 필요 없다. */
export function DemoHelpLinks({ compact = false }: { compact?: boolean }) {
  const link = `inline-flex items-center hover:underline ${compact ? 'min-h-6' : 'min-h-11'}`;
  return (
    <nav aria-label="데모 안내" className="flex flex-wrap items-center gap-x-3 type-caption text-text">
      <a href={QUICKSTART_URL} target="_blank" rel="noopener noreferrer" className={link}>
        설치 가이드
      </a>
      <a href="https://ai-turn.github.io/everyup/" target="_blank" rel="noopener noreferrer" className={link}>
        소개
      </a>
    </nav>
  );
}
