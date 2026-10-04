<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'

// 홈 히어로 아래의 제품 화면 캐러셀. 슬라이드는 홈 frontmatter의 carousel 항목이고,
// 이미지는 /images/home/slide-<image>-light.png 와 -dark.png 짝 (데모 빌드 1440x900 캡처).
// 자동 넘김은 넣지 않는다 (읽는 중에 화면이 바뀌면 안 된다).
interface Slide {
  title: string
  caption: string
  image: string
  alt: string
}

const DEMO = 'https://ai-turn.github.io/everyup/demo/'

const { frontmatter, lang } = useData()
const slides = computed<Slide[]>(() => frontmatter.value.carousel ?? [])
const ko = computed(() => lang.value === 'ko')
const track = ref<HTMLElement | null>(null)
const index = ref(0)
const current = computed(() => slides.value[index.value] ?? slides.value[0])

function go(i: number) {
  const el = track.value
  if (!el) return
  const n = slides.value.length
  const target = ((i % n) + n) % n
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollTo({ left: target * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
}

function onScroll() {
  const el = track.value
  if (el) index.value = Math.round(el.scrollLeft / el.clientWidth)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    go(index.value + 1)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    go(index.value - 1)
  }
}
</script>

<template>
  <section
    v-if="slides.length"
    class="home-carousel"
    aria-roledescription="carousel"
    :aria-label="ko ? '제품 화면' : 'Product screens'"
  >
    <div
      ref="track"
      class="home-carousel-track"
      tabindex="0"
      :aria-label="ko ? '제품 화면 (좌우 화살표 키로 넘기기)' : 'Product screens (use the arrow keys)'"
      @scroll.passive="onScroll"
      @keydown="onKey"
    >
      <div
        v-for="(s, i) in slides"
        :key="s.image"
        class="home-carousel-slide"
        role="group"
        aria-roledescription="slide"
        :aria-label="`${i + 1} / ${slides.length}: ${s.title}`"
      >
        <img
          class="only-light"
          :src="withBase(`/images/home/slide-${s.image}-light.png`)"
          width="1440"
          height="900"
          :alt="s.alt"
          :loading="i === 0 ? 'eager' : 'lazy'"
          decoding="async"
        />
        <img
          class="only-dark"
          :src="withBase(`/images/home/slide-${s.image}-dark.png`)"
          width="1440"
          height="900"
          :alt="s.alt"
          :loading="i === 0 ? 'eager' : 'lazy'"
          decoding="async"
        />
      </div>
    </div>

    <div class="home-carousel-bar">
      <p class="home-carousel-caption" aria-live="polite">
        <strong>{{ current.title }}</strong>
        <span>{{ current.caption }}</span>
      </p>
      <div class="home-carousel-controls">
        <button type="button" class="home-carousel-arrow" :aria-label="ko ? '이전 화면' : 'Previous screen'" @click="go(index - 1)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div class="home-carousel-dots">
          <button
            v-for="(s, i) in slides"
            :key="s.image"
            type="button"
            class="home-carousel-dot"
            :aria-label="`${i + 1}: ${s.title}`"
            :aria-current="i === index ? 'true' : undefined"
            @click="go(i)"
          />
        </div>
        <button type="button" class="home-carousel-arrow" :aria-label="ko ? '다음 화면' : 'Next screen'" @click="go(index + 1)">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
    </div>

    <p v-if="ko" class="home-carousel-demo">직접 조작해 보려면 <a :href="DEMO">라이브 데모</a>를 여세요.</p>
    <p v-else class="home-carousel-demo">The dashboard UI is Korean only. Try it in the <a :href="DEMO">live demo</a>.</p>
  </section>
</template>
