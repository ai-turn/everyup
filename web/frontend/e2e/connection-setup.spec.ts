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

test('existing collector gains metrics without creating a new Docker environment', async ({ page }) => {
  await page.goto('./metrics');
  await page.getByRole('button', { name: '메트릭 연결', exact: true }).click();
  await page.getByRole('button', { name: '기존 모니터링 대상' }).click();
  await page.getByRole('option', { name: 'staging-api · Docker 환경 전체' }).click();
  await page.getByRole('button', { name: '기존 대상 연결 확인' }).click();
  const chooser = page.getByRole('dialog');
  await chooser.getByRole('button', { name: '메트릭 추가 및 적용 명령' }).click();
  const installer = page.getByRole('dialog', { name: 'Docker 수집기 설치 및 모니터링 설정' });
  await expect(installer.getByText('Docker 수집기 연결을 기다리는 중', { exact: true })).toBeVisible();
  await expect(installer.getByText(/사용 업타임, 로그, 메트릭/)).toBeVisible();
  await expect(installer.getByLabel('EveryUp 외부 연결 주소')).toHaveValue('https://monitor.example.com');
  await expect(installer.getByRole('button', { name: '설치 명령 복사' })).toBeEnabled();
  await expect(installer.getByText('Docker 수집기 연결을 확인했습니다', { exact: true })).toHaveCount(0);
  await installer.getByRole('button', { name: '나중에 확인' }).click();
  await page.getByRole('button', { name: '메트릭 연결', exact: true }).click();
  await page.getByRole('button', { name: '기존 대상 연결 확인' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '사용할 Docker 환경' }).click();
  await expect(page.getByRole('option')).toHaveCount(2);
  await page.getByRole('option', { name: 'staging-api' }).click();
  await expect(page.getByText('이미 선택된 기능입니다. 데이터 수신 기록을 확인하세요.')).toBeVisible();
});

test('direct setup uses an external endpoint and waits for actual data', async ({ page }) => {
  await page.goto('./logs');
  await page.getByRole('button', { name: '로그 연결', exact: true }).click();
  await page.getByRole('button', { name: 'OpenTelemetry로 직접 연결' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('서비스 이름').fill('new-log-service');
  await dialog.getByRole('button', { name: '추가하기', exact: true }).click();
  await expect(dialog.getByLabel('EveryUp 외부 연결 주소')).toHaveValue('https://monitor.example.com');
  await expect(dialog.locator('pre')).toContainText('OTEL_EXPORTER_OTLP_ENDPOINT=https://monitor.example.com/api/v1/otlp');
  const receipts = dialog.getByRole('region', { name: '데이터 수신 확인' });
  await expect(receipts).toContainText('로그');
  await expect(receipts).toContainText('수신 대기');
  await dialog.getByRole('button', { name: '처음 설정', exact: true }).click();
  await dialog.getByRole('button', { name: '앱 언어' }).click();
  await page.getByRole('option', { name: 'Go', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'Go 계측·SDK 설정 예제' })).toBeVisible();
  await dialog.getByLabel('EveryUp 외부 연결 주소').fill('http://localhost:3001');
  await expect(dialog.getByRole('button', { name: '환경 변수 복사' })).toBeDisabled();
});

test('existing Docker service opens the selected monitoring tab', async ({ page }) => {
  await page.goto('./logs');
  await page.getByRole('button', { name: '로그 연결', exact: true }).click();
  await page.getByRole('button', { name: '기존 모니터링 대상' }).click();
  await page.getByRole('option', { name: 'prod-server / api', exact: true }).click();
  await page.getByRole('button', { name: '기존 대상 연결 확인' }).click();
  await page.getByRole('button', { name: '로그 보기', exact: true }).click();
  await expect(page).toHaveURL(/services\/agent_demo_01\/shop%3Aapi\?tab=logs/);
  await expect(page.getByRole('tab', { name: '로그', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('instrumentation requires explicit targets and invalidates changed previews', async ({ page }) => {
  await page.goto('./agents/agent_demo_01');
  await page.getByRole('button', { name: '계측 설정', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'OpenTelemetry 자동 적용' });
  await expect(dialog.getByRole('button', { name: '변경 사항 확인' })).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'api 계측' }).check();
  await dialog.getByRole('button', { name: '변경 사항 확인' }).click();
  await expect(dialog.getByText('재시작 대상: api', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '서버 변경 미리보기 복사' })).toBeVisible();
  await expect(dialog.locator('pre')).toContainText('--report=');
  await expect(dialog.locator('pre')).toContainText("'api=node'");
  await expect(dialog.getByRole('region', { name: '계측 실행 결과' })).toContainText('서버에서 명령 실행 대기');
  await dialog.getByRole('checkbox', { name: 'api 계측' }).uncheck();
  await expect(dialog.getByRole('button', { name: '안전 적용 명령 복사' })).toHaveCount(0);
});

test('mobile connection chooser stays within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./infrastructure');
  await page.getByRole('button', { name: '인프라 연결', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: '표준 Collector 연결' })).toBeVisible();
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});
