<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const { lang } = useData()
const ko = computed(() => lang.value === 'ko')
const link = (path: string) => withBase((ko.value ? '' : '/en') + path)
</script>

<template>
  <nav class="home-connection-links" :aria-label="ko ? '다른 대상 연결' : 'Connect other targets'">
    <span>{{ ko ? '다른 대상 연결:' : 'Connect other targets:' }}</span>
    <a :href="link('/guide/uptime-monitors')">{{ ko ? '공개 URL·TCP 포트' : 'Public URLs and TCP ports' }}</a>
    <a :href="link('/guide/monitoring-setup') + '#direct-otel'">{{ ko ? 'Docker 밖의 앱' : 'Apps outside Docker' }}</a>
  </nav>
</template>

<style scoped>
.home-connection-links {
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
.home-connection-links a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.home-connection-links a:hover {
  color: var(--vp-c-brand-2);
}
</style>
