import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { api, type NotificationChannel } from '../../services/api';
import { ChannelForm } from '../../features/alerts/components/ChannelForm';
import { Button, MaterialIcon } from '../../components/common';
import { getErrorMessage } from '../../utils/errors';

export function ChannelFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [channel, setChannel] = useState<NotificationChannel | undefined>();
  const [loading, setLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.getNotificationChannels();
        if (cancelled) return;
        const found = list.find(c => c.id === id);
        if (!found) {
          toast.error('채널을 찾을 수 없습니다');
          navigate('/alerts');
          return;
        }
        setChannel(found);
      } catch (error) {
        toast.error(getErrorMessage(error));
        navigate('/alerts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, navigate]);

  const goBack = () => navigate('/alerts');

  useBreadcrumb([{ label: loading ? '...' : isEdit ? (channel?.name ?? '수정') : '새 채널' }]);

  const title = isEdit
    ? '채널 편집'
    : '채널 추가';

  return (
    // lg에서는 모바일 Header(3.5rem) 대신 AppHeader(4rem)가 붙으므로 빼는 값이 다르다.
    // 자체 breadcrumb은 AppHeader로 옮겼다 — `채널` 크럼은 `알림`과 목적지가 같아 뺐다.
    // 음수 마진은 본문 래퍼(`p-4 sm:px-6 sm:py-5`)의 패딩을 **정확히** 되돌리는 값이어야
    // 한다. 이전 `md:-m-8`은 존재하지 않는 32px 패딩을 가정해 8px 더 당겼고, 그만큼
    // AppHeader breadcrumb보다 왼쪽으로 튀어나가 있었다.
    <div className="-m-4 sm:-mx-6 sm:-my-5 flex flex-col bg-bg-main h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-8rem)]">
      {/* Page header */}
      <header className="flex-none border-b border-ui-border px-6 py-3 bg-bg-surface">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-text-base tracking-tight">{title}</h1>
            <p className="text-sm text-text-muted mt-0.5">
              {isEdit
                ? `${channel?.name ?? ''} · 채널 설정을 수정합니다`
                : 'Telegram, Discord, Slack 중 채널을 선택하고 연결 정보를 입력하세요'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="secondary" onClick={goBack}>
              취소
            </Button>
            <Button
              type="submit"
              form="channel-form"
              disabled={loading || isSubmitting}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <MaterialIcon size={20} name="save" />
                  저장
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <ChannelForm
            channel={channel}
            onSuccess={goBack}
            onCancel={goBack}
            onSubmittingChange={setIsSubmitting}
          />
        )}
      </div>
    </div>
  );
}
