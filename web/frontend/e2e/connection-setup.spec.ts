import { expect, test } from '@playwright/test';
import { connectionBaseUrl, validConnectionUrl } from '../src/features/services/connectionAddress';

test('connection URLs resolve relative API paths and respect the configured external origin', () => {
  expect(connectionBaseUrl('', '/api/v1', 'https://monitor.example.org')).toBe('https://monitor.example.org');
  expect(connectionBaseUrl('https://external.example.org/everyup/', '/api/v1', 'https://internal.example.org')).toBe('https://external.example.org/everyup');
  expect(connectionBaseUrl('', 'https://api.example.org/api/v1', 'https://ui.example.org')).toBe('https://api.example.org');
  for (const url of ['/api/v1', 'http://localhost:3001', 'http://127.0.0.1', 'http://[::1]', 'https://user:secret@host.test', 'https://host.test/?key=secret', 'javascript:alert(1)']) {
    expect(validConnectionUrl(url), url).toBe(false);
  }
});

test('existing collector gains metrics from its Docker environment', async ({ page }) => {
  // 수집 프로필은 Docker 환경 화면에서만 바꾼다(ADR 0007).
  await page.goto('./agents/agent_demo_02');
  await page.getByRole('button', { name: '메트릭 추가', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: '메트릭 수집 추가' });
  await chooser.getByRole('button', { name: '메트릭 추가 및 적용 명령' }).click();
  const installer = page.getByRole('dialog', { name: 'Docker Collector 설치 및 모니터링 설정' });
  await expect(installer.getByText('Docker Collector 연결을 기다리는 중', { exact: true })).toBeVisible();
  await expect(installer.getByText(/사용: 업타임, 로그, 메트릭/)).toBeVisible();
  await expect(installer.getByLabel('EveryUp 외부 연결 주소')).toHaveValue('https://monitor.example.com');
  await expect(installer.getByRole('button', { name: '설치 명령 복사' })).toBeEnabled();
  await expect(installer.getByText('Docker Collector 연결을 확인했습니다', { exact: true })).toHaveCount(0);
  await installer.getByRole('button', { name: '나중에 확인' }).click();
  await expect(page.getByRole('button', { name: '메트릭 추가', exact: true })).toHaveCount(0);
  await expect(page.getByText(/사용: 업타임, 로그, 메트릭/)).toBeVisible();
});

test('direct setup uses an external endpoint and waits for actual data', async ({ page }) => {
  await page.goto('./logs');
  await page.getByRole('button', { name: '로그 연결', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('서비스 이름').fill('new-log-service');
  await dialog.getByRole('button', { name: '추가', exact: true }).click();
  await expect(dialog.getByLabel('EveryUp 외부 연결 주소')).toHaveValue('https://monitor.example.com');
  const env = dialog.locator('pre');
  await expect(env).toContainText('OTEL_EXPORTER_OTLP_ENDPOINT=https://monitor.example.com/api/v1/otlp');
  // A logs-only key refuses traces and metrics, so the SDK must not send them.
  await expect(env).toContainText('OTEL_TRACES_EXPORTER=none');
  await expect(env).toContainText('OTEL_METRICS_EXPORTER=none');
  await expect(env).not.toContainText('OTEL_LOGS_EXPORTER');
  // The key is shown once; a click on the backdrop must not close it away.
  await page.mouse.click(5, 5);
  await expect(dialog.getByText('API Key는 지금 한 번만 표시됩니다.', { exact: false })).toBeVisible();
  const receipts = dialog.getByRole('region', { name: '데이터 수신 확인' });
  await expect(receipts).toContainText('로그');
  await expect(receipts).toContainText('수신 대기');
  await dialog.getByRole('button', { name: '처음 설정', exact: true }).click();
  await dialog.getByRole('combobox', { name: '앱 언어' }).click();
  await page.getByRole('option', { name: 'Go', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'Go SDK 설정 예제' })).toBeVisible();
  await dialog.getByLabel('EveryUp 외부 연결 주소').fill('http://localhost:3001');
  await expect(dialog.getByRole('button', { name: '환경 변수 복사' })).toBeDisabled();
});

test('menu connection offers direct targets only', async ({ page }) => {
  await page.goto('./logs');
  await page.getByRole('button', { name: '로그 연결', exact: true }).click();
  const dialog = page.getByRole('dialog');
  // Container stdout logs are a Docker environment's job, not this dialog's.
  await expect(dialog.getByRole('link', { name: 'Docker 환경' })).toHaveAttribute('href', /\/environments$/);
  await dialog.getByRole('button', { name: '기존 서비스', exact: true }).click();
  await dialog.getByRole('combobox', { name: '서비스' }).click();
  await expect(page.getByRole('option', { name: /Docker|prod-server/ })).toHaveCount(0);
  // Only services that do not send logs yet can take them on.
  await expect(page.getByRole('option', { name: 'catalog-worker' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'checkout-api' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Docker Collector 설치' })).toHaveCount(0);
});

test('instrumentation requires explicit targets and invalidates changed previews', async ({ page }) => {
  await page.goto('./agents/agent_demo_01');
  await page.getByRole('button', { name: '상세 수집 설정', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: '상세 수집 설정' });
  await expect(dialog.getByRole('button', { name: '변경 사항 확인' })).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'api 상세 수집' }).check();
  await dialog.getByRole('button', { name: '변경 사항 확인' }).click();
  await expect(dialog.getByText('재시작 대상: api', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '서버 변경 미리보기 복사' })).toBeVisible();
  await expect(dialog.locator('pre')).toContainText('--report=');
  await expect(dialog.locator('pre')).toContainText("'api=node'");
  await expect(dialog.getByRole('region', { name: '상세 수집 적용 결과' })).toContainText('서버에서 명령 실행 대기');
  await dialog.getByRole('checkbox', { name: 'api 상세 수집' }).uncheck();
  await expect(dialog.getByRole('button', { name: '안전 적용 명령 복사' })).toHaveCount(0);
});

test('mobile infrastructure setup stays within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./infrastructure');
  await page.getByRole('button', { name: '인프라 연결', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('인프라 이름')).toBeVisible();
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});
