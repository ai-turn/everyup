/** 연결 대화 상자의 적용 범위 한 줄. 모든 연결 대화 상자에서 설명 바로 아래 같은 자리에 둔다(DESIGN.md §9.17). */
export function ApplyScope({ children }: { children: string }) {
  return <p className="type-body text-text"><span className="font-medium text-text">적용 범위</span> {children}</p>;
}
