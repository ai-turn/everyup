import type { NotificationChannel } from '../../services/api';

export const mockChannels: NotificationChannel[] = [
  {
    id: '1',
    name: 'Ops Telegram',
    type: 'telegram',
    config: JSON.stringify({ botToken: '***', chatId: '-100123456' }),
    isEnabled: true,
    createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  },
  {
    id: '2',
    name: '#alerts Discord',
    type: 'discord',
    config: JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/…' }),
    isEnabled: true,
    createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
  },
  {
    id: '3',
    name: '#incidents Slack',
    type: 'slack',
    config: JSON.stringify({ webhookUrl: 'https://hooks.slack.com/services/…' }),
    isEnabled: true,
    createdAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  },
];
