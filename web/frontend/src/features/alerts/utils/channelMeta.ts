export type ChannelStyle = { bg: string; text: string };

// 채널 아바타는 브랜드 색을 쓰지 않는다 — 테마 토큰 밖의 색이고, 아이콘이 이미 채널을 구분한다.
const channelStyle: ChannelStyle = { bg: 'bg-surface-hover', text: 'text-text-muted' };

export function getChannelStyle(_type: string): ChannelStyle {
  return channelStyle;
}

const channelNames: Record<string, string> = { telegram: 'Telegram', discord: 'Discord', slack: 'Slack' };

export function getChannelName(type: string): string {
  return channelNames[type] ?? type;
}

// Brand name + transport, e.g. "Telegram · Bot API" — brand names are not translated
const channelSubtitles: Record<string, string> = {
  telegram: 'Telegram · Bot API',
  discord: 'Discord · Webhook',
  slack: 'Slack · Webhook',
};

export function getChannelSubtitle(type: string): string {
  return channelSubtitles[type] ?? type;
}
