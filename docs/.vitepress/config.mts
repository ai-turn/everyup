import { defineConfig } from 'vitepress'

const GH = 'https://github.com/ai-turn/everyup'
// 데모는 같은 Pages 사이트의 /demo/에 따로 배포된다. 절대 URL이라 문서 라우터가 가로채지 않는다.
const DEMO = 'https://ai-turn.github.io/everyup/demo/'

export default defineConfig({
  base: '/everyup/',
  title: 'EveryUp',
  cleanUrls: true,
  // 페이지마다 마지막 수정일(git 커밋 시각)을 보여준다. 배포 워크플로가 전체 이력을 받아야 정확하다.
  lastUpdated: true,
  // docs/에는 사이트에 올리지 않는 내부 문서도 함께 있다.
  srcExclude: ['adr/**', 'agents/**', 'CHANGELOG.md', 'monitoring-capability-release-gate.md'],
  head: [
    ['link', { rel: 'icon', href: '/everyup/images/logo.webp' }],
    // 링크 미리보기는 절대 URL만 받는다
    ['meta', { property: 'og:image', content: 'https://ai-turn.github.io/everyup/images/everyup-main-ko.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    // 한국어는 어절 단위로 줄바꿈 ("모니터/링" 방지)
    ['style', {}, 'html:lang(ko) { word-break: keep-all; }'],
  ],

  themeConfig: {
    logo: '/images/logo.webp',
    socialLinks: [{ icon: 'github', link: GH }],
    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '검색', buttonAriaLabel: '검색' },
              modal: {
                noResultsText: '결과가 없습니다',
                resetButtonTitle: '지우기',
                backButtonTitle: '검색 닫기',
                displayDetails: '상세 목록 표시',
                footer: {
                  selectText: '선택',
                  selectKeyAriaLabel: 'Enter 키',
                  navigateText: '이동',
                  navigateUpKeyAriaLabel: '위쪽 화살표',
                  navigateDownKeyAriaLabel: '아래쪽 화살표',
                  closeText: '닫기',
                  closeKeyAriaLabel: 'Esc 키',
                },
              },
            },
          },
        },
      },
    },
  },

  locales: {
    root: {
      label: '한국어',
      lang: 'ko',
      description: 'Docker Collector, OpenTelemetry, HTTP·TCP 체크로 업타임·로그·인프라·API를 한 화면에서 보는 셀프호스팅 모니터링',
      themeConfig: {
        nav: [
          { text: '가이드', link: '/guide/introduction' },
          { text: '레퍼런스', link: '/reference/web' },
          { text: '데모', link: DEMO },
        ],
        sidebar: [
          {
            text: '시작하기',
            items: [
              { text: '소개', link: '/guide/introduction' },
              { text: 'Quick Start', link: '/guide/quickstart' },
              { text: '모니터링 설정', link: '/guide/monitoring-setup' },
            ],
          },
          {
            text: '기능 가이드',
            items: [
              { text: '자동 eBPF Observer', link: '/guide/ebpf-observer' },
              { text: '헤더·바디 상세 수집', link: '/guide/otel-instrumentation' },
              { text: '알림 채널', link: '/guide/notifications' },
            ],
          },
          {
            text: '운영',
            items: [
              { text: '백업·복원', link: '/guide/backup-restore' },
              { text: '트러블슈팅', link: '/guide/troubleshooting' },
            ],
          },
          {
            text: '레퍼런스',
            items: [
              { text: 'Web 설정', link: '/reference/web' },
              { text: 'Docker Collector 설정', link: '/reference/collector' },
              { text: 'Docker socket proxy (영문)', link: `${GH}/blob/main/agent/docs/docker-socket-proxy.md` },
              { text: 'Collector 동작 방식 (영문)', link: `${GH}/tree/main/agent/docs` },
            ],
          },
        ],
        editLink: { pattern: `${GH}/edit/main/docs/:path`, text: 'GitHub에서 이 페이지 편집' },
        outline: { label: '이 페이지에서' },
        docFooter: { prev: '이전', next: '다음' },
        darkModeSwitchLabel: '테마',
        darkModeSwitchTitle: '다크 테마로 전환',
        lightModeSwitchTitle: '라이트 테마로 전환',
        skipToContentLabel: '본문으로 건너뛰기',
        lastUpdated: { text: '마지막 수정' },
        sidebarMenuLabel: '메뉴',
        returnToTopLabel: '맨 위로',
        langMenuLabel: '언어',
        notFound: { title: '페이지를 찾을 수 없습니다', quote: '', linkText: '홈으로' },
      },
    },
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      description: 'Self-hosted monitoring for uptime, logs, infrastructure, and APIs through a Docker Collector, OpenTelemetry, or HTTP/TCP checks',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/en/guide/introduction' },
          { text: 'Reference', link: '/en/reference/web' },
          { text: 'Demo', link: DEMO },
        ],
        sidebar: [
          {
            text: 'Getting Started',
            items: [
              { text: 'Introduction', link: '/en/guide/introduction' },
              { text: 'Quick Start', link: '/en/guide/quickstart' },
              { text: 'Monitoring setup', link: '/en/guide/monitoring-setup' },
            ],
          },
          {
            text: 'Feature Guides',
            items: [
              { text: 'Automatic eBPF Observer', link: '/en/guide/ebpf-observer' },
              { text: 'Header & body capture', link: '/en/guide/otel-instrumentation' },
              { text: 'Notification channels', link: '/en/guide/notifications' },
            ],
          },
          {
            text: 'Operations',
            items: [
              { text: 'Backup and restore', link: '/en/guide/backup-restore' },
              { text: 'Troubleshooting', link: '/en/guide/troubleshooting' },
            ],
          },
          {
            text: 'Reference',
            items: [
              { text: 'Web configuration', link: '/en/reference/web' },
              { text: 'Docker Collector configuration', link: '/en/reference/collector' },
              { text: 'Docker socket proxy', link: `${GH}/blob/main/agent/docs/docker-socket-proxy.md` },
              { text: 'How the Collector works', link: `${GH}/tree/main/agent/docs` },
            ],
          },
        ],
        editLink: { pattern: `${GH}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
      },
    },
  },
})
