interface ToggleProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	title?: string;
	ariaLabel?: string;
}

export function Toggle({ checked, onChange, disabled = false, title, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
		aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      title={title}
      // 꺼진 트랙은 text-dim(표면 대비 3:1 이상), before는 시각 크기는 그대로 두고 터치 영역만 44px로 넓힌다.
      className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] ${
        checked ? 'bg-primary' : 'bg-text-dim'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
