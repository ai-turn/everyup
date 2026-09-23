import { SectionCard } from './SectionCard';
import { SettingRow } from './SettingRow';

const OPTIONS = [1, 2, 3, 5];

// 알림 발송 조건(연속 실패 횟수). 백엔드 /settings의 alerts.consecutiveFailures와
// 1:1 — 선택 즉시 저장된다 (별도 저장 버튼 없음).
export function AlertsSection({ value, loading, onChange }: {
  value: number;
  loading: boolean;
  onChange: (n: number) => void;
}) {
  // 표준 옵션 밖의 값(config 직접 수정 등)도 선택지로 노출해 현재값이 숨지 않게 한다.
  const options = OPTIONS.includes(value) ? OPTIONS : [...OPTIONS, value].sort((a, b) => a - b);

  return (
    <SectionCard title="알림 임계값" subtitle="알림 발송 조건 설정">
      {loading ? (
        <div className="h-10 bg-ui-hover rounded-lg animate-pulse" />
      ) : (
        <SettingRow
          label="연속 실패 횟수"
          description="알림을 발송하기 전 필요한 연속 실패 횟수"
        >
          <div className="flex gap-1 bg-ui-hover p-0.5 rounded-lg">
            {options.map((n) => (
              <button
                key={n}
                onClick={() => onChange(n)}
                className={`cursor-pointer h-9 px-3 rounded-md type-label transition-all ${
                  value === n
                    ? 'bg-ui-raised text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {n}회
              </button>
            ))}
          </div>
        </SettingRow>
      )}
    </SectionCard>
  );
}
