import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, CopyButton, IconButton, Input, Tooltip, TooltipProvider } from '../../src/components/common';
import { COPY_ACTION_SUBTLE } from '../../src/components/common/CopyButton';
import '../../src/index.css';

export function TooltipChecks() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [clicks, setClicks] = useState(0);
  const longHint = '긴 경로 /v1/payments/'.repeat(30);
  return <TooltipProvider><main className="min-h-screen bg-bg-main p-4 text-text-base">
    <p id="existing-description">기존 설명</p>
    <Button title="공통 액션 도움말" aria-describedby="existing-description" onClick={() => setClicks(value => value + 1)}>액션 {clicks}</Button>
    <Button title="입력 중에는 변경할 수 없습니다" disabled>비활성 액션</Button>
    <CopyButton onCopy={() => true} title="값 복사" className={COPY_ACTION_SUBTLE}>복사</CopyButton>
    <Button onClick={() => input.current?.focus()}>입력 포커스</Button>
    <Input ref={input} aria-label="설정 값" title="입력값 도움말" />
    <Button onClick={() => dialog.current?.showModal()}>대화상자 열기</Button>
    <div className="mt-4 h-12 overflow-hidden border border-ui-border">
      <Tooltip content={longHint} focusable><span className="block w-28 truncate">긴 경로 정보</span></Tooltip>
    </div>
    <div className="fixed bottom-2 right-2">
      <IconButton icon="help_outline" label="화면 가장자리 도움말" />
    </div>
    <dialog ref={dialog} aria-label="설정 대화상자" className="m-auto overflow-hidden rounded-xl border border-ui-border bg-bg-surface p-4 text-text-base animate-zoom-in">
      <Input aria-label="대화상자 값" title="대화상자 안 도움말" />
      <Button onClick={() => dialog.current?.close()}>닫기</Button>
    </dialog>
  </main></TooltipProvider>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><TooltipChecks /></StrictMode>);
