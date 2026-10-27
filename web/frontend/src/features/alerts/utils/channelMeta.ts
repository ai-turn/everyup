export type ChannelStyle = { bg: string; text: string };

const channelStyles: Record<string, ChannelStyle> = {
  telegram: { bg: 'bg-sky-500/10', text: 'text-sky-500' },
  discord: { bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
  slack: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
};

const fallbackStyle: ChannelStyle = { bg: 'bg-slate-500/10', text: 'text-slate-500' };

export function getChannelStyle(type: string): ChannelStyle {
  return channelStyles[type] ?? fallbackStyle;
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
