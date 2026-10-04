<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

// 홈 frontmatter의 showcase 항목을 실제 제품 화면과 함께 그린다.
// 이미지는 /images/home/<image>-light.png 와 -dark.png 짝 (데모 빌드에서 캡처, 16:9).
interface ShowcaseItem {
  title: string
  details: string
  link: string
  linkText: string
  image: string
  alt: string
}

const { frontmatter } = useData()
const items = computed<ShowcaseItem[]>(() => frontmatter.value.showcase ?? [])
</script>

<template>
  <section v-if="items.length" class="home-showcase" aria-labelledby="home-showcase-title">
    <h2 id="home-showcase-title" class="home-showcase-title">{{ frontmatter.showcaseTitle }}</h2>
    <div class="home-showcase-grid">
      <article v-for="item in items" :key="item.image" class="home-showcase-item">
        <div class="home-showcase-media">
          <img class="only-light" :src="withBase(`/images/home/${item.image}-light.png`)" :alt="item.alt" loading="lazy" decoding="async" />
          <img class="only-dark" :src="withBase(`/images/home/${item.image}-dark.png`)" :alt="item.alt" loading="lazy" decoding="async" />
        </div>
        <h3>{{ item.title }}</h3>
        <p>{{ item.details }}</p>
        <a :href="withBase(item.link)">{{ item.linkText }}<span aria-hidden="true"> →</span></a>
      </article>
    </div>
  </section>
</template>
