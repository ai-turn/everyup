import { Button, ButtonLink, MaterialIcon, OverflowMenu, StatusLight, type GlobalTimeRange, type OverflowMenuItem } from '../../../components/common';
import type { ObservedService } from '../../../services/api';
import { formatDateTime } from '../../../utils/incidentFormat';
import { alertRulesPath } from '../../alerts/alertTarget';
import { SIGNAL_TARGET, connectAction } from '../../connections/connectCopy';
import { LogIngestLevels } from '../../logs/components/LogIngestLevels';
import { TargetHeader, type TargetConnection } from '../../targets/TargetHeader';
import { signalList } from '../../telemetry/signals';
import type { useDirectServicePanel } from '../../telemetry/useDirectServicePanel';
import { serverPath } from '../serverPaths';
import type { ServerRow } from '../serverStatus';
import type { AppTabItem, appSummary } from './appTabs';

type HeaderProps = Parameters<typeof TargetHeader>[0];

/**
 * 앱 페이지의 머리말(DESIGN.md §4.7 대상 상세). 상태 줄, 연결 줄(받지 않는 유형을 더하거나 설정을 다시 받는다), 연결 정보,
 * 알림 규칙과 더보기(옮기기, 연결 해제·삭제).
 */
export function AppHeader({ row, app, summary, connection, removalItem, back, range, onRangeChange, refresh, onStartSetup, onStartMove }: {
  row: ServerRow;
  app: ObservedService;
  summary: Pick<ReturnType<typeof appSummary>, 'status' | 'missing'>;
  connection: ReturnType<typeof useDirectServicePanel>['connection'];
  removalItem: OverflowMenuItem;
  back: HeaderProps['back'];
  range: GlobalTimeRange;
  onRangeChange: (range: GlobalTimeRange) => void;
  refresh: HeaderProps['refresh'];
  onStartSetup: (item: AppTabItem) => void;
  onStartMove: () => void;
}) {
  const { status, missing } = summary;
  return (
    <TargetHeader
      title={app.name}
      crumbs={[{ label: row.server.name, to: serverPath(row.server.id) }]}
      back={back}
      status={<>
        <StatusLight tone={status.tone} label={status.label} />
        {status.detail && <span>{status.detail}</span>}
        {!status.stale && <span>마지막 수집 {app.lastSeenAt ? formatDateTime(app.lastSeenAt) : '아직 없음'}</span>}
        {/* 상태와 그 상태를 바꾸는 액션을 붙여 둔다. */}
        {connection.isActive && <Button variant="ghost" onClick={connection.onRevoke}><MaterialIcon name="block" />연결 중지</Button>}
      </>}
      connection={{ kind: 'otel', detail: <>{signalList(app.signals)} 수신</>, action: connectionAction(missing, onStartSetup, connection.onRotateKey) }}
      fieldsLabel="연결 정보"
      fields={[
        { label: 'API Key', value: <>
          <span className="truncate font-mono">{connection.apiKeyMasked || '마스킹된 키 없음'}</span>
          <Button variant="ghost" className="ml-auto" onClick={connection.onRotateKey}><MaterialIcon name="key" />키 재발급</Button>
        </> },
        { label: '수집 데이터', value: signalList(app.signals) },
        ...(app.signals.includes('logs') ? [{ label: '수집 레벨', value: <LogIngestLevels observedServiceId={app.id} /> }] : []),
      ]}
      actions={<>
        <ButtonLink collapseLabel variant="secondary" to={alertRulesPath({ kind: 'direct', serviceId: app.id })}>
          <MaterialIcon name="notifications" />알림 규칙
        </ButtonLink>
        <OverflowMenu items={[{ label: '다른 서버로 옮기기', icon: 'arrow_forward', onSelect: onStartMove }, removalItem]} />
      </>}
      range={range}
      onRangeChange={onRangeChange}
      refresh={refresh}
    />
  );
}

/**
 * 연결 줄의 조작. 직접 연결은 앱과 데이터 유형 단위다. 받지 않는 유형이 있으면 그 유형의 탭으로 옮기면서 연결 대화 상자를 연다
 * (둘 이상이면 고르는 메뉴). 다 받으면 설정을 다시 받는다. 예전 `데이터 추가`는 탭만 옮겨서 한 번 더 눌러야 했다.
 */
function connectionAction(missing: AppTabItem[], onStartSetup: (item: AppTabItem) => void, onRotateKey: () => void): TargetConnection['action'] {
  if (missing.length === 1) return { label: '연결 추가', onClick: () => onStartSetup(missing[0]) };
  if (missing.length > 1) return { label: '연결 추가', menu: missing.map((item) => ({ label: connectAction(SIGNAL_TARGET[item.signal]), onSelect: () => onStartSetup(item) })) };
  return { label: '설정 다시 받기', onClick: onRotateKey };
}
