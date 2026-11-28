import { Tooltip } from './Tooltip';

interface ToggleProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	title?: string;
	ariaLabel?: string;
}

export function Toggle({ checked, onChange, disabled = false, title, ariaLabel }: ToggleProps) {
  return (
    <Tooltip content={title}><button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      // 꺼진 트랙은 text-dim(표면 대비 3:1 이상), before는 시각 크기는 그대로 두고 터치 영역만 44px로 넓힌다.
      // 강제 색상 모드는 채움을 지운다: 트랙은 외곽선, 켜짐은 시스템 Highlight로 남긴다.
      // 켜짐은 상태 채움(초록)이다. primary 검은 채움이면 알림 표의 토글 열·업타임 헤더 스위치가 화면에서 가장 진했다.
      className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] forced-colors:outline forced-colors:outline-1 ${
      checked ? 'bg-ok forced-colors:bg-[Highlight]' : 'bg-text-faint'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 forced-colors:bg-[CanvasText] rounded-full bg-surface shadow transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button></Tooltip>
  );
}
