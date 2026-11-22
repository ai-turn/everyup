import type { Locator, Page } from '@playwright/test';

/**
 * 상세 머리말의 `더보기` 메뉴(OverflowMenu)를 열고 항목을 돌려준다. 드물게 쓰는 조작과 파괴적 조작은 이 메뉴 안에 있다
 * (DESIGN.md §4.1 상세 헤더). 메뉴는 포털이라 항목은 scope 밖(page)에서 찾는다.
 */
export async function menuItem(scope: Page | Locator, name: string | RegExp): Promise<Locator> {
  const page = typeof (scope as Locator).page === 'function' ? (scope as Locator).page() : scope as Page;
  await scope.getByRole('button', { name: '더보기', exact: true }).first().click();
  return page.getByRole('menuitem', typeof name === 'string' ? { name, exact: true } : { name });
}
