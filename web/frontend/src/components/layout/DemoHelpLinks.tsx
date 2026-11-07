export const QUICKSTART_URL = 'https://ai-turn.github.io/everyup/guide/quickstart';

export function DemoHelpLinks() {
  return (
    <nav aria-label="데모 안내" className="flex flex-wrap items-center gap-x-3 text-xs text-action">
      <a href={QUICKSTART_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center hover:underline">
        실제 사용 시작하기
      </a>
      <a href="https://ai-turn.github.io/everyup/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center hover:underline">
        서비스 소개
      </a>
    </nav>
  );
}
