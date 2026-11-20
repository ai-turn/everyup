import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Button, MaterialIcon, PageHeader } from '../../components/common';
import { useBreadcrumb } from '../../contexts/BreadcrumbContext';
import { ServerFields } from '../../features/servers/components/ServerFields';
import { SERVERS_PATH, serverPath } from '../../features/servers/serverPaths';
import { useServerForm } from '../../features/servers/useServerForm';
import { api } from '../../services/api';

export function ServerFormPage() {
  const navigate = useNavigate();
  useBreadcrumb([{ label: '서버 추가' }]);
  const form = useServerForm({ name: '', description: '', projectId: '' });
  const { saving } = form;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void form.submit(async (input) => {
      const server = await api.createServer(input);
      toast.success('서버를 만들었습니다');
      // 뒤로 가기가 다시 빈 추가 화면으로 오지 않게 기록을 바꾼다.
      navigate(serverPath(server.id), { replace: true, state: { focusPanel: true } });
    });
  };

  return (
    <div>
      <PageHeader title="서버 추가" subtitle="이름만 정하면 서버가 만들어집니다. 기능은 서버 화면의 각 탭에서 연결합니다." />
      <form onSubmit={submit} noValidate className="max-w-lg">
        <fieldset disabled={saving} className="space-y-4">
          <ServerFields form={form} idPrefix="new-server" />
        </fieldset>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(SERVERS_PATH, { replace: true })} disabled={saving}>취소</Button>
          <Button type="submit" loading={saving}><MaterialIcon name="add" />서버 추가</Button>
        </div>
      </form>
    </div>
  );
}
