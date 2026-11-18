// Tabs.tsx는 컴포넌트만 export해야 fast refresh가 동작하므로 id 함수는 따로 둔다.
export const tabId = (idPrefix: string, key: string) => `${idPrefix}-tab-${key}`;
export const tabPanelId = (idPrefix: string, key: string) => `${idPrefix}-panel-${key}`;
