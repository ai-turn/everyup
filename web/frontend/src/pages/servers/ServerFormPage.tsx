import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, MaterialIcon, OptionText, PageHeader } from '../../components/common';
import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { ServerFields } from '../../features/servers/components/ServerFields';
import { INSTALL_DOCKER_STATE, SERVERS_PATH, serverPath } from '../../features/servers/serverPaths';
import { useServerForm } from '../../features/servers/useServerForm';
import { api } from '../../services/api';

type Connection = 'later' | 'docker';

// 연결 방식(ADR 0012). Docker를 쓰는 호스트는 Docker Collector 하나로 컨테이너·로그·인프라·API 요청을 한 번에 연결한다.
// 그 밖의 기능(업타임 모니터, 직접 OpenTelemetry, OpenTelemetry Collector 인프라)은 서버 화면의 각 탭에서 연결한다.
const CONNECTIONS: { value: Connection; title: string; description: string }[] = [
  { value: 'later', title: '나중에 연결', description: '업타임 모니터, 앱의 OpenTelemetry, 인프라는 서버 화면의 각 탭에서 연결합니다.' },
  { value: 'docker', title: 'Docker Collector 설치', description: 'Docker를 쓰는 호스트입니다. 컨테이너 상태·로그·인프라·API 요청을 한 번에 수집합니다.' },
];

export function ServerFormPage() {
  const navigate = useNavigate();
  useBreadcrumb([{ label: '서버 추가' }]);
  const form = useServerForm({ name: '', description: '', projectId: '' });
  const { saving } = form;
  // 옛 `Docker 연결`은 `?connection=docker`로 와서 Docker Collector 설치를 고른 채로 연다.
  const [params] = useSearchParams();
  const [connection, setConnection] = useState<Connection>(params.get('connection') === 'docker' ? 'docker' : 'later');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void form.submit(async (input) => {
      const server = await api.createServer(input);
      toast.success('서버를 만들었습니다');
      // 뒤로 가기가 다시 빈 추가 화면으로 오지 않게 기록을 바꾼다. Docker를 골랐으면 서버 화면에서 설치 창을 이어서 연다.
      navigate(serverPath(server.id), { replace: true, state: connection === 'docker' ? { [INSTALL_DOCKER_STATE]: true } : { focusPanel: true } });
    });
  };

  return (
    <div>
      <PageHeader title="서버 추가" subtitle="이름을 정하고 연결 방식을 고르세요. 서버가 만들어진 뒤에도 각 탭에서 기능을 더할 수 있습니다." />
      <form onSubmit={submit} noValidate className="max-w-lg">
        <fieldset disabled={saving} className="space-y-heading">
          <ServerFields form={form} idPrefix="new-server" />
          <fieldset className="space-y-label">
            <legend className="mb-label type-label text-text-base">연결 방식</legend>
            {CONNECTIONS.map((option) => (
              <label key={option.value} className="-mx-2 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-ui-hover-soft">
                <input type="radio" name="server-connection" value={option.value} checked={connection === option.value} onChange={() => setConnection(option.value)}
                  className="icon-lead h-4 w-4 shrink-0 cursor-pointer accent-primary" />
                <OptionText title={option.title} description={option.description} />
              </label>
            ))}
          </fieldset>
        </fieldset>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(SERVERS_PATH, { replace: true })} disabled={saving}>취소</Button>
          <Button type="submit" loading={saving}><MaterialIcon name="add" />서버 추가</Button>
        </div>
      </form>
    </div>
  );
}
