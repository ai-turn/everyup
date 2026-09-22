import { useState } from 'react';
import { MaterialIcon } from '../../../components/common';

interface SetupGuideProps {
    type: 'telegram' | 'discord' | 'slack';
}

const GUIDE_TIPS: Record<SetupGuideProps['type'], string> = {
    telegram: '그룹 채팅의 Chat ID는 마이너스(-)로 시작합니다 (예: -100123456789). 봇을 먼저 그룹에 추가한 후 getUpdates를 확인하세요.',
    discord: '웹후크는 특정 채널에 연결됩니다. 여러 채널에 알림을 보내려면 채널별로 웹후크를 따로 만드세요.',
    slack: '각 웹훅은 특정 채널에 연결됩니다. 같은 Slack 앱에서 여러 채널용 웹훅을 만들 수 있습니다.',
};

export function SetupGuide({ type }: SetupGuideProps) {

    const [isOpen, setIsOpen] = useState(false);

    const stepsMap: Record<string, string[]> = {
        telegram: [
            '텔레그램에서 @BotFather를 검색하세요',
            '/newbot 명령어를 보내고 안내에 따라 봇을 생성하세요',
            'BotFather가 제공하는 봇 토큰을 복사하세요',
            '봇에게 아무 메시지를 보낸 후, https://api.telegram.org/bot<TOKEN>/getUpdates 에 접속하여 Chat ID를 확인하세요',
        ],
        discord: [
            '디스코드 서버 설정 → 연동 → 웹후크로 이동하세요',
            '"새 웹후크"를 클릭하고 대상 채널을 선택한 후 이름을 설정하세요',
            '"웹후크 URL 복사"를 클릭하여 위 입력란에 붙여넣으세요',
        ],
        slack: [
            'https://api.slack.com/apps 에서 새 앱을 생성하세요 (또는 기존 앱 선택)',
            '"Incoming Webhooks"로 이동하여 활성화한 후 "Add New Webhook to Workspace"를 클릭하세요',
            '알림을 보낼 채널을 선택하고, 웹훅 URL을 복사하여 위 입력란에 붙여넣으세요',
        ],
    };

    const steps = stepsMap[type] || [];
    const tip = GUIDE_TIPS[type];

    return (
        <div className="rounded-lg border border-ui-border overflow-hidden">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-ui-hover-soft transition-colors"
            >
                <MaterialIcon size={20}
                    name="help_outline"
                    className="text-primary shrink-0"
                />
                <span className="text-sm font-medium text-text-secondary flex-1">
                    API 키는 어떻게 발급받나요?
                </span>
                <MaterialIcon size={20}
                    name={isOpen ? 'expand_less' : 'expand_more'}
                    className="text-text-dim shrink-0"
                />
            </button>

            {isOpen && (
                <div className="px-3 pb-3 space-y-3 border-t border-ui-border-soft">
                    <ol className="mt-3 space-y-2">
                        {steps.map((step, i) => (
                            <li key={i} className="flex gap-2 text-sm text-text-secondary">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">
                                    {i + 1}
                                </span>
                                <span className="pt-0.5">{step}</span>
                            </li>
                        ))}
                    </ol>

                    {tip && (
                        <div className="flex gap-2 px-2.5 py-2 rounded-md bg-ui-hover-soft border border-ui-border">
                            <MaterialIcon size={20} name="lightbulb" className="text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-text-secondary">{tip}</p>
                        </div>
                    )}

                    <a
                        href="https://github.com/ai-turn/everyup/blob/main/docs/NOTIFICATION_SETUP.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                        <MaterialIcon size={20} name="open_in_new" />
                        상세 가이드 보기
                    </a>
                </div>
            )}
        </div>
    );
}
