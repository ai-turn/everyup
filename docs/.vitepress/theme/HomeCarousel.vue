<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'

// 홈 히어로 아래의 제품 화면 캐러셀. 슬라이드는 홈 frontmatter의 carousel 항목이고,
// 이미지는 /images/home/slide-<image>-light.webp 와 -dark.webp 짝 (데모 빌드 1440x900 캡처)이고,
// 좁은 화면용 -720.webp 사본이 함께 있다.
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

const shot = (image: string, theme: 'light' | 'dark', suffix = '') => withBase(`/images/home/slide-${image}-${theme}${suffix}.webp`)
const shotSet = (image: string, theme: 'light' | 'dark') => `${shot(image, theme, '-720')} 720w, ${shot(image, theme)} 1440w`

// 버튼으로 넘길 때의 목적지. 부드러운 스크롤 도중에 다시 누르면 지나가는 중간 위치가 아니라
// 이 목적지를 기준으로 한 칸 더 간다 (없으면 빠르게 연달아 누를 때 같은 슬라이드에 멈춘다).
let pending: number | null = null
let pendingTimer: ReturnType<typeof setTimeout> | undefined

function go(i: number) {
  const el = track.value
  if (!el) return
  const n = slides.value.length
  const target = ((i % n) + n) % n
  pending = target
  index.value = target
  clearTimeout(pendingTimer)
  pendingTimer = setTimeout(() => { pending = null }, 1000) // 스크롤이 중간에 끊겨도 풀리게
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollTo({ left: target * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
}

function onScroll() {
  const el = track.value
  if (!el) return
  const at = Math.round(el.scrollLeft / el.clientWidth)
  if (pending !== null) {
    if (at === pending) pending = null
    return
  }
  index.value = at // 터치로 밀어서 넘긴 경우
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
    <!-- 화살표와 점은 이미지 위에 겹친다: 화살표는 양옆 세로 가운데, 점은 아래 가운데 -->
    <div class="home-carousel-stage">
      <div
        ref="track"
        class="home-carousel-track"
        role="region"
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
          <!-- 전부 lazy: 첫 장은 화면 안이라 바로 받고, display:none인 반대 테마 사본은 받지 않는다 -->
          <img
            class="only-light"
            :src="shot(s.image, 'light')"
            :srcset="shotSet(s.image, 'light')"
            sizes="(max-width: 1152px) 100vw, 1152px"
            width="1440"
            height="900"
            :alt="s.alt"
            loading="lazy"
            :fetchpriority="i === 0 ? 'high' : undefined"
            decoding="async"
          />
          <img
            class="only-dark"
            :src="shot(s.image, 'dark')"
            :srcset="shotSet(s.image, 'dark')"
            sizes="(max-width: 1152px) 100vw, 1152px"
            width="1440"
            height="900"
            :alt="s.alt"
            loading="lazy"
            :fetchpriority="i === 0 ? 'high' : undefined"
            decoding="async"
          />
        </div>
      </div>

      <button type="button" class="home-carousel-arrow is-prev" :aria-label="ko ? '이전 화면' : 'Previous screen'" @click="go(index - 1)">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <button type="button" class="home-carousel-arrow is-next" :aria-label="ko ? '다음 화면' : 'Next screen'" @click="go(index + 1)">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
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
    </div>

    <div class="home-carousel-bar">
      <p class="home-carousel-caption" aria-live="polite">
        <strong>{{ current.title }}</strong>
        <span>{{ current.caption }}</span>
      </p>
      <span class="home-carousel-count" aria-hidden="true">{{ index + 1 }} / {{ slides.length }}</span>
    </div>

    <!-- 데모는 같은 origin(/everyup/demo/)이라 target이 없으면 VitePress 라우터가 문서 페이지로 가로채 404가 난다 -->
    <p v-if="ko" class="home-carousel-demo">직접 조작해 보려면 <a :href="DEMO" target="_blank" rel="noreferrer">라이브 데모</a>를 여세요.</p>
    <p v-else class="home-carousel-demo">The dashboard UI is Korean only. Try it in the <a :href="DEMO" target="_blank" rel="noreferrer">live demo</a>.</p>
  </section>
</template>
