import { Tooltip } from '../../../components/common/Tooltip';
import { MaterialIcon } from '../../../components/common';
import { ChannelIcon } from '../../../components/icons/ChannelIcons';
import type { AlertRule, NotificationChannel } from '../../../services/api';
import { getChannelStyle } from '../utils/channelMeta';

const MAX_CHANNEL_AVATARS = 4;

export function ChannelAvatars({ rule, channels }: { rule: AlertRule; channels: NotificationChannel[] }) {

  // Empty channelIds = the rule notifies all channels
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

  const visible = ruleChannels.slice(0, MAX_CHANNEL_AVATARS);
  const overflow = ruleChannels.length - visible.length;
  const names = ruleChannels.map(c => c.name).join(', ');

  return (
    <Tooltip content={names} focusable><div className="flex items-center">
      {visible.map((ch, i) => {
        const style = getChannelStyle(ch.type);
        return (
          <div
            key={ch.id}
            className={`flex h-6 w-6 items-center justify-center rounded-md ring-2 ring-white dark:ring-bg-surface-dark ${style.bg} ${i > 0 ? '-ml-1.5' : ''}`}
          >
            <ChannelIcon type={ch.type} size={13} className={style.text} />
          </div>
        );
      })}
      {overflow > 0 && (
        <span className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-500 ring-2 ring-white dark:bg-ui-hover-dark dark:text-text-muted-dark dark:ring-bg-surface-dark">
          +{overflow}
        </span>
      )}
    </div></Tooltip>
  );
}
