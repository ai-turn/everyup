import { Button, MaterialIcon } from '../common';

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main p-8">
      <div className="text-center max-w-md">
        <MaterialIcon
          name="error_outline"
          className="text-8xl text-red-500 mb-4"
        />

        <h1 className="text-2xl font-bold text-text-base mb-2">
          문제가 발생했습니다
        </h1>

        <p className="text-text-muted mb-4">
          예기치 않은 오류가 발생했습니다. 페이지를 새로고침하거나 홈으로 돌아가세요.
        </p>

        {import.meta.env.DEV && error && (
          <pre className="text-left text-xs bg-ui-hover p-4 rounded-lg mb-4 overflow-auto max-h-32">
            {error.message}
          </pre>
        )}

        <div className="flex gap-4 justify-center">
          <Button variant="secondary" onClick={onReset}>
            다시 시도
          </Button>
          <Button onClick={handleGoHome}>
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  );
}
