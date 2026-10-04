import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import HomeShot from './HomeShot.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  // 홈: 히어로 바로 아래에 대시보드 스크린샷을 둔다 (기본 레이아웃에는 이 자리가 없다)
  Layout: () => h(DefaultTheme.Layout, null, { 'home-hero-after': () => h(HomeShot) }),
}
