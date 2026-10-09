import { h } from 'vue'
// 폰트는 custom.css의 Spoqa만 쓴다. 기본 테마의 Inter는 받기만 하고 화면에 쓰이지 않았다.
import DefaultTheme from 'vitepress/theme-without-fonts'
// 공개 API가 아니라 내부 컴포넌트다(vitepress가 ./dist/*를 export). 버전을 올릴 때 경로를 확인할 것.
import VPNavBarMenu from 'vitepress/dist/client/theme-default/components/VPNavBarMenu.vue'
import HomeCarousel from './HomeCarousel.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      // 상단 바: 기본 DOM 순서는 검색 → 메뉴라서, 메뉴를 왼쪽에 보여 주면 키보드 순서가 화면과 어긋난다.
      // 메뉴를 검색 앞에 다시 그리고 원래 메뉴는 custom.css에서 숨긴다.
      'nav-bar-content-before': () => h(VPNavBarMenu, { class: 'menu-lead' }),
      // 홈: 히어로 바로 아래에 제품 화면 캐러셀 (기본 레이아웃에는 이 자리가 없다)
      'home-hero-after': () => h(HomeCarousel),
    }),
}
