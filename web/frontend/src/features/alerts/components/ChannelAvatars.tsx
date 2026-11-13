import { Tooltip } from '../../../components/common/Tooltip';
import { MaterialIcon } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import type { AlertRule, NotificationChannel } from '../../../services/api';
import { getChannelStyle } from '../utils/channelMeta';

const MAX_CHANNEL_AVATARS = 4;

export function ChannelAvatars({ rule, channels }: { rule: AlertRule; channels: NotificationChannel[] }) {

  // 채널을 고르지 않은 규칙은 켜진 채널 전부로 보낸다. 고른 채널도 꺼져 있으면 서버가 건너뛴다(alerter/manager.go).
  const ruleChannels = !rule.channelIds || rule.channelIds.length === 0
    ? channels
    : rule.channelIds
        .map(cid => channels.find(c => c.id === cid))
        .filter((c): c is NotificationChannel => !!c);

  if (ruleChannels.length === 0) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 text-sm text-text-dim">
        <MaterialIcon size={20} name="notifications_off" className="shrink-0" />
        <span className="truncate">등록된 알림 채널이 없습니다</span>
      </span>
    );
  }

  // 실제로 보낼 곳이 없으면 정상 규칙과 똑같이 보이지 않게 말한다(A-13).
  if (!ruleChannels.some(c => c.isEnabled)) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 text-sm text-status-warn">
        <MaterialIcon size={20} name="notifications_off" className="shrink-0" />
        <span className="truncate">보낼 채널 없음</span>
      </span>
    );
  }

  const visible = ruleChannels.slice(0, MAX_CHANNEL_AVATARS);
  const overflow = ruleChannels.length - visible.length;
  const names = ruleChannels.map(c => c.isEnabled ? c.name : `${c.name} (꺼짐)`).join(', ');

  return (
    // 아바타는 아이콘뿐이라 채널 이름을 접근 이름으로 준다(A-15).
    <Tooltip content={names} focusable><div role="img" aria-label={`알림 채널: ${names}`} className="flex items-center">
      {visible.map((ch, i) => {
        const style = getChannelStyle(ch.type);
        return (
          <div
            key={ch.id}
            className={`flex h-6 w-6 items-center justify-center rounded-md ring-2 ring-bg-surface ${style.bg} ${i > 0 ? '-ml-1.5' : ''} ${ch.isEnabled ? '' : 'opacity-40'}`}
          >
            <ChannelIcon type={ch.type} size={13} className={style.text} />
          </div>
        );
      })}
      {overflow > 0 && (
        <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-ui-hover text-xs text-text-muted ring-2 ring-bg-surface">
          +{overflow}
        </span>
      )}
    </div></Tooltip>
  );
}
