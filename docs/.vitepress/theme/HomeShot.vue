<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const DEMO = 'https://ai-turn.github.io/everyup/demo/'

const { lang } = useData()
const ko = computed(() => lang.value === 'ko')
const alt = computed(() => ko.value
  ? 'EveryUp 개요 화면. 확인이 필요한 서비스로 장애가 난 payment-worker, Docker 환경 2개·업타임 모니터 2개·직접 연결 서비스 3개·인프라 리소스 2개의 모니터링 범위, 최근 장애 이력 3건이 보인다.'
  : 'The EveryUp overview: payment-worker flagged as down, a monitoring scope of 2 Docker environments, 2 uptime monitors, 3 directly connected services and 2 infrastructure resources, and 3 recent incidents.')
</script>

<template>
  <figure class="home-shot">
    <img class="only-light" :src="withBase('/images/home/overview-light.png')" width="1440" height="900" :alt="alt" />
    <img class="only-dark" :src="withBase('/images/home/overview-dark.png')" width="1440" height="900" :alt="alt" />
    <figcaption v-if="ko" class="screenshot-caption">
      개요 화면. 직접 조작해 보려면 <a :href="DEMO">라이브 데모</a>를 여세요.
    </figcaption>
    <figcaption v-else class="screenshot-caption">
      The overview screen. The dashboard UI is Korean only. Try it in the <a :href="DEMO">live demo</a>.
    </figcaption>
  </figure>
</template>
