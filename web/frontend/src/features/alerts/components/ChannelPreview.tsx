// 채널 폼의 미리보기: 각 서비스(Telegram, Discord, Slack)의 실제 메시지 모양을 흉내 낸다. 크기·색·간격이 우리 체계가 아니라
// 그 서비스의 화면을 따르므로 pnpm lint의 글자 역할(S6)과 간격 규칙(S2·S3·S8)에서 뺀다(DESIGN.md §1.7, §3.7).
import { IconTelegram, IconDiscord, IconSlack } from '../../../components/icons/ChannelIcons';
// ─── Accurate preview components (matching real backend output) ───────────────

// Telegram: plain-text Markdown message rendered in a chat bubble
export function TelegramPreview({ name }: { name: string }) {
    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return (
        <div className="rounded-xl overflow-hidden border border-[#334155] font-sans text-xs">
            {/* Header bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#17212B]">
                <div className="w-7 h-7 rounded-full bg-[#26A5E4] flex items-center justify-center shrink-0">
                    <IconTelegram size={14} className="text-[#ffffff]" />
                </div>
                <div className="min-w-0">
                    <p className="text-[#ffffff] type-label-sm leading-tight truncate">{name || 'EveryUp Bot'}</p>
                    <p className="text-[#7C91A7] text-xs">bot</p>
                </div>
            </div>
            {/* Chat body */}
            <div className="bg-[#0E1621] px-3 py-3">
                <div className="bg-[#182533] rounded-lg rounded-tl-none px-3 py-2.5 max-w-[90%] space-y-1 leading-[1.6]">
                    <p>
                        <span className="text-[#5FBDE3]">✅ Service Recovered</span>
                    </p>
                    <p className="text-[#cbd5e1]">
                        <span className="text-[#7C91A7]">Service: </span>Notification Test
                    </p>
                    <p className="text-[#cbd5e1]">
                        <span className="text-[#7C91A7]">Time: </span>
                        {new Date().toISOString().slice(0, 19).replace('T', ' ')}
                    </p>
                    <p className="text-[#cbd5e1]">
                        <span className="text-[#7C91A7]">Message: </span>
                        <span className="text-[#94a3b8]">This is a test notification. Your EVERYUP notification channel is connected correctly.</span>
                    </p>
                    <p className="text-[#7C91A7] text-xs text-right">{now}</p>
                </div>
            </div>
        </div>
    );
}

// Discord: embed card matching backend output
export function DiscordPreview({ name }: { name: string }) {
    return (
        <div className="rounded-xl overflow-hidden border border-[#1e1f22] font-sans text-xs">
            {/* Header bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#313338]">
                <div className="w-7 h-7 rounded-full bg-[#5865F2] flex items-center justify-center shrink-0">
                    <IconDiscord size={14} className="text-[#ffffff]" />
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[#ffffff] font-medium">{name || 'EVERYUP'}</span>
                    <span className="px-1 py-px bg-[#5865F2] text-[#ffffff] text-xs rounded uppercase">APP</span>
                </div>
            </div>
            {/* Message area */}
            <div className="bg-[#313338] px-3 pb-3 pt-1">
                {/* Embed */}
                <div className="border-l-4 border-[#3baa7c] bg-[#2b2d31] rounded-r-lg overflow-hidden">
                    <div className="px-3 py-2.5 space-y-2">
                        {/* Embed title */}
                        <p className="text-[#3baa7c]">✅ Service healthy: Notification Test</p>
                        {/* Embed description */}
                        <p className="text-[#dbdee1] leading-relaxed">
                            This is a test notification. Your EVERYUP notification channel is connected correctly.
                        </p>
                        {/* Fields row */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1">
                            <div>
                                <p className="text-[#b5bac1] text-xs uppercase mb-0.5">Service ID</p>
                                <p className="text-[#dbdee1]">test</p>
                            </div>
                            <div>
                                <p className="text-[#b5bac1] text-xs uppercase mb-0.5">Status</p>
                                <p className="text-[#dbdee1]">healthy</p>
                            </div>
                        </div>
                        {/* Footer */}
                        <p className="text-[#87898c] text-xs pt-1 border-t border-[#3f4147]">
                            EVERYUP • {new Date().toISOString().slice(0, 10)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Slack: Block Kit attachment matching backend output
export function SlackPreview({ name }: { name: string }) {
    return (
        <div className="rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-[#424242] font-sans text-xs">
            {/* Header bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#4A154B]">
                <div className="w-7 h-7 rounded bg-[#ffffff] flex items-center justify-center shrink-0">
                    <IconSlack size={14} className="text-[#E01E5A]" />
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[#ffffff] font-medium">{name || 'EVERYUP'}</span>
                    <span className="px-1 py-px bg-[#ffffff40] text-[#ffffff] text-xs rounded uppercase">APP</span>
                </div>
            </div>
            {/* Message body */}
            <div className="bg-[#ffffff] dark:bg-[#1a1d21] px-3 py-2.5">
                {/* Attachment with left colored border */}
                <div className="border-l-4 border-[#2eb67d] pl-2.5 space-y-1.5">
                    {/* Header section */}
                    <p className="text-text">
                        ✅ <span className="italic">Service healthy: Notification Test</span>
                    </p>
                    {/* Message section */}
                    <p className="text-text-muted leading-relaxed">
                        This is a test notification. Your EVERYUP notification channel is connected correctly.
                    </p>
                    {/* Fields row */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-0.5">
                        <div>
                            <p className="text-text text-xs">Service ID</p>
                            <p className="text-text-muted">test</p>
                        </div>
                        <div>
                            <p className="text-text text-xs">Status</p>
                            <p className="text-text-muted">healthy</p>
                        </div>
                    </div>
                    {/* Context footer */}
                    <p className="text-text-faint text-xs pt-1">
                        EVERYUP • {new Date().toISOString().slice(0, 10).replace(/-/g, '-')} {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                </div>
            </div>
        </div>
    );
}
