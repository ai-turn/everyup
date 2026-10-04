<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const DEMO = 'https://ai-turn.github.io/everyup/demo/'

const { lang } = useData()
const ko = computed(() => lang.value === 'ko')
</script>

<template>
  <figure class="home-shot">
    <img
      :src="withBase('/images/everyup-main-ko.png')"
      width="1440"
      height="618"
      :alt="ko
        ? 'EveryUp 개요 화면. Docker 수집기 2개, 서비스 8개 중 1개 장애, 확인이 필요한 서비스로 payment-worker가 보인다.'
        : 'The EveryUp overview: 2 Docker collectors, 8 services with 1 failing, and payment-worker listed as needing attention.'"
    />
    <figcaption v-if="ko" class="screenshot-caption">
      개요 화면. 직접 조작해 보려면 <a :href="DEMO">라이브 데모</a>를 여세요.
    </figcaption>
    <figcaption v-else class="screenshot-caption">
      The overview screen. The dashboard UI is Korean only. Try it in the <a :href="DEMO">live demo</a>.
    </figcaption>
  </figure>
</template>
