<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { VPButton } from 'vitepress/theme'

// 홈 마지막 섹션: 히어로의 주 행동(시작하기)을 같은 문구·같은 버튼으로 한 번 더 두고,
// Docker가 아닌 대상으로 시작하는 사람을 위한 링크를 함께 둔다 (히어로 행동은 두 개까지).
const { lang } = useData()
const ko = computed(() => lang.value === 'ko')
const link = (path: string) => withBase((ko.value ? '' : '/en') + path)
</script>

<template>
  <section class="home-closing">
    <h2>{{ ko ? '서버 한 대에서 시작합니다' : 'Start with one server' }}</h2>
    <p>
      {{
        ko
          ? 'Web만 실행하면 업타임 모니터를 바로 추가할 수 있고, Docker 환경은 나중에 연결해도 됩니다.'
          : 'Run Web and add uptime monitors right away. Connect Docker environments later.'
      }}
    </p>
    <!-- VPButton은 href에 base를 직접 붙인다: withBase를 거친 link()를 넘기면 /everyup/everyup/이 된다 -->
    <VPButton tag="a" size="medium" theme="brand" :text="ko ? '시작하기' : 'Get started'" :href="(ko ? '' : '/en') + '/guide/quickstart'" />
    <nav class="home-closing-links" :aria-label="ko ? '다른 대상 연결' : 'Connect other targets'">
      <span>{{ ko ? '다른 대상 연결:' : 'Connect other targets:' }}</span>
      <a :href="link('/guide/uptime-monitors')">{{ ko ? '공개 URL·TCP 포트' : 'Public URLs and TCP ports' }}</a>
      <a :href="link('/guide/monitoring-setup') + '#direct-otel'">{{ ko ? 'Docker 밖의 앱' : 'Apps outside Docker' }}</a>
    </nav>
  </section>
</template>

<style scoped>
.home-closing {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0 auto;
  padding: 96px 24px 64px;
  max-width: 1152px;
  text-align: center;
}
/* 휴대폰에서 히어로 h1이 28px이라 그보다 한 단계 작게 */
.home-closing h2 {
  font-size: 24px;
  line-height: 32px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
@media (min-width: 640px) {
  .home-closing h2 {
    font-size: 28px;
    line-height: 36px;
  }
}
.home-closing p {
  margin: 12px 0 28px;
  max-width: 560px;
  font-size: 16px;
  line-height: 26px;
  color: var(--vp-c-text-2);
}
.home-closing-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0 16px;
  margin-top: 16px;
  font-size: 14px;
  line-height: 22px;
  color: var(--vp-c-text-2);
}
.home-closing-links a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.home-closing-links a:hover {
  color: var(--vp-c-brand-2);
}
</style>
