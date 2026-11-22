import { useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { SIGNAL_TARGET, connectDone } from '../../connections/connectCopy';
import type { AppTab } from '../serverPaths';
import type { AppTabItem } from './appTabs';

/**
 * 앱에 아직 받지 않는 데이터 유형을 더하는 대화 상자의 상태. `연결 전` 탭에서 열거나(`openSetup`), 연결 줄에서 그 유형의 탭으로
 * 옮기면서 연다(`startSetup`). 서버 데이터를 다시 불러온 뒤에 닫고 알린다. 결과를 본 뒤 닫기(X)로 닫아도 다시 불러온다.
 */
export function useAttachSetup(openTab: (tab: AppTab) => void, onChanged: () => Promise<void>) {
  const [adding, setAdding] = useState<AppTabItem | null>(null);
  // 대화 상자가 권한을 더했다(결과 화면이 열렸다).
  const issued = useRef(false);
  // 결과의 "보기"를 눌렀다. 닫기(X)와 구분해 한 번만 처리한다.
  const created = useRef(false);
  const openSetup = (item: AppTabItem) => { issued.current = false; created.current = false; setAdding(item); };
  // 연결 줄에서 시작하면 데이터가 들어올 탭을 먼저 보인다. 대화 상자를 마치면 그 자리에 있다.
  const startSetup = (item: AppTabItem) => { openTab(item.key); openSetup(item); };
  const finishSetup = async () => {
    if (created.current) return;
    created.current = true;
    const signal = adding?.signal;
    await onChanged();
    setAdding(null);
    if (signal) toast.success(connectDone(SIGNAL_TARGET[signal]));
  };
  const closeSetup = () => {
    if (created.current) return;
    setAdding(null);
    if (issued.current) void onChanged();
  };
  const markIssued = () => { issued.current = true; };
  return { adding, openSetup, startSetup, finishSetup, closeSetup, markIssued };
}
