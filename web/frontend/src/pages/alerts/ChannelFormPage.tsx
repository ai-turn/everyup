import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { api, type NotificationChannel } from '../../services/api';
import { ChannelForm } from '../../features/alerts/components/ChannelForm';
import { FormActions } from '../../features/alerts/components/FormLayout';
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
    // lg에서는 화면 높이에 고정하고 본문만 스크롤한다(AppHeader 4rem 등을 뺀 값).
    // 모바일은 높이를 계산하지 않는다 — 데모 배너처럼 위에 붙는 크롬이 늘면 계산이 틀려
    // 제출 바가 BottomNavMobile 뒤로 숨었다. 대신 제출 바를 하단 내비 위에 sticky로 붙인다.
    // 자체 breadcrumb은 AppHeader로 옮겼다 — `채널` 크럼은 `알림`과 목적지가 같아 뺐다.
    // 음수 마진은 본문 래퍼(`p-4 sm:px-6 sm:py-5`)의 패딩을 **정확히** 되돌리는 값이어야
    // 한다. 이전 `md:-m-8`은 존재하지 않는 32px 패딩을 가정해 8px 더 당겼고, 그만큼
    // AppHeader breadcrumb보다 왼쪽으로 튀어나가 있었다.
    <div className="-m-4 sm:-mx-6 sm:-my-5 flex flex-col bg-bg-main lg:h-[calc(100dvh-8rem)]">
      {/* Page header */}
      <header className="flex-none border-b border-ui-border px-6 py-3 bg-bg-surface">
        <h1 className="type-page-title text-text-base">{title}</h1>
        <p className="text-sm text-text-muted mt-0.5">
          {isEdit
            ? `${channel?.name ?? ''} · 채널 설정을 수정합니다`
            : 'Telegram, Discord, Slack 중 채널을 선택하고 연결 정보를 입력하세요'}
        </p>
      </header>

      {/* Form body */}
      <div className="lg:flex-1 lg:overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full py-16 text-text-muted">
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

      {/* 제출 바는 데스크톱 사이드 패널(FormSidePanel)과 같은 자리 — 하단 우측 (DESIGN.md §7) */}
      <footer
        className="sticky z-10 flex-none flex items-center justify-end gap-2 border-t border-ui-border bg-bg-surface px-5 py-3 lg:static"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <FormActions formId="channel-form" isEdit={isEdit} isSubmitting={isSubmitting} disabled={loading} onCancel={goBack} />
      </footer>
    </div>
  );
}
