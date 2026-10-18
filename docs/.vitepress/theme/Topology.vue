<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

// 무엇이 어느 서버에 설치되고 연결이 어느 방향으로 생기는지 보여 주는 배치 구성도. 홈(히어로 아래)과 소개 페이지에서 쓴다.
// 이미지가 아니라 텍스트라서 스크린 리더가 그대로 읽고, 폭이 좁으면(컨테이너 860px 미만, 문서 본문 포함) 세로로 쌓인다.
// 문법은 diagram-design skill의 deployment 유형을 따른다: 서버 = 점선 영역, 설치되는 것 = 칩, 연결 = 프로토콜·포트.
// 근거: 설치기 Compose(agent_installer.go)는 호스트 포트를 열지 않는다. eBPF Observer는 API 요청 수집을 고를 때만 설치된다.
// 아이콘: Tabler Icons(MIT) 24px · 1.5 stroke. bell을 뺀 나머지는 diagram-design의 primitive-icons.md에서 가져왔다.
const icons = {
  server: ['M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3', 'M3 15a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -2', 'M7 8l0 .01', 'M7 16l0 .01'],
  container: ['M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5', 'M12 12l8 -4.5', 'M12 12l0 9', 'M12 12l-8 -4.5', 'M16 5.25l-8 4.5'],
  docker: ['M22 12.54c-1.804 -.345 -2.701 -1.08 -3.523 -2.94c-.487 .696 -1.102 1.568 -.92 2.4c.028 .238 -.32 1 -.557 1h-14c0 5.208 3.164 7 6.196 7c4.124 .022 7.828 -1.376 9.854 -5c1.146 -.101 2.296 -1.505 2.95 -2.46', 'M5 10h3v3h-3l0 -3', 'M8 10h3v3h-3l0 -3', 'M11 10h3v3h-3l0 -3', 'M8 7h3v3h-3l0 -3', 'M11 7h3v3h-3l0 -3', 'M11 4h3v3h-3l0 -3', 'M4.571 18c1.5 0 2.047 -.074 2.958 -.78', 'M10 16l0 .01'],
  search: ['M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-6 -6'],
  monitoring: ['M4 19l16 0', 'M4 15l4 -6l4 2l4 -5l4 4'],
  bell: ['M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6', 'M9 17v1a3 3 0 0 0 6 0v-1'],
}

const { lang } = useData()
const ko = computed(() => lang.value === 'ko')
const link = (path: string) => withBase((ko.value ? '' : '/en') + path)

const t = computed(() =>
  ko.value
    ? {
        host: '모니터링할 서버',
        hostNote: 'Docker 호스트마다',
        existing: '기존',
        app: '앱 컨테이너',
        appDesc: '수정하지 않음',
        collectorDesc: '컨테이너 상태 · 로그 · 호스트 메트릭',
        optional: '선택',
        ebpfDesc: 'API latency · 트레이스',
        readOnly: '읽기 전용',
        traces: '트레이스',
        outbound: '나가는 연결만',
        dash: '대시보드 서버',
        webDesc: '대시보드 · 이력 저장 · 알림 규칙',
        uptime: '업타임 모니터',
        uptimeDesc: '외부 URL·TCP 응답 확인',
        otel: 'OTLP 직접 수신',
        otelDesc: 'Docker 밖의 앱',
        alert: '장애 알림',
        channels: '알림 채널',
        caption:
          '모니터링할 서버의 Docker Collector가 대시보드 서버의 Web으로 데이터를 보내고, Web은 알림 규칙에 따라 채널로 알림을 보냅니다. 모니터링할 서버에는 들어오는 포트를 열지 않습니다.',
      }
    : {
        host: 'Monitored server',
        hostNote: 'one per Docker host',
        existing: 'existing',
        app: 'App containers',
        appDesc: 'left unchanged',
        collectorDesc: 'Container state · logs · host metrics',
        optional: 'optional',
        ebpfDesc: 'API latency · traces',
        readOnly: 'read-only',
        traces: 'traces',
        outbound: 'outbound only',
        dash: 'Dashboard server',
        webDesc: 'Dashboard · history · alert rules',
        uptime: 'Uptime monitors',
        uptimeDesc: 'Checks external URLs and TCP ports',
        otel: 'Direct OTLP intake',
        otelDesc: 'Apps outside Docker',
        alert: 'Alerts',
        channels: 'Alert channels',
        caption:
          'The Docker Collector on each monitored server sends data to Web on the dashboard server, and Web sends alerts to your channels according to your alert rules. No inbound ports are opened on monitored servers.',
      },
)
</script>

<template>
  <figure class="topology">
    <div class="topology-flow">
      <div class="topology-zone">
        <p class="topology-place"><svg class="topology-icon" viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in icons.server" :key="d" :d="d" /></svg>{{ t.host }} <span>{{ t.hostNote }}</span></p>
        <div class="topology-chip is-existing">
          <svg class="topology-icon" viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in icons.container" :key="d" :d="d" /></svg>
          <span class="topology-tag">{{ t.existing }}</span>
          <strong>{{ t.app }}</strong>
          <span class="topology-sub">{{ t.appDesc }}</span>
        </div>
        <div class="topology-hop">
          <svg class="topology-hop-arrow" viewBox="0 0 12 24" aria-hidden="true"><path d="M6 0v20M1 15l5 5 5-5" /></svg>
          <code>docker.sock</code><span>{{ t.readOnly }}</span>
        </div>
        <div class="topology-chip">
          <svg class="topology-icon" viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in icons.docker" :key="d" :d="d" /></svg>
          <a :href="link('/reference/collector')">Docker Collector</a>
          <span class="topology-sub">{{ t.collectorDesc }}</span>
        </div>
        <div class="topology-hop">
          <svg class="topology-hop-arrow" viewBox="0 0 12 24" aria-hidden="true"><path d="M6 24V4M1 9l5-5 5 5" /></svg>
          <code>OTLP :4318</code><span>{{ t.traces }}</span>
        </div>
        <div class="topology-chip is-optional">
          <svg class="topology-icon" viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in icons.search" :key="d" :d="d" /></svg>
          <span class="topology-tag">{{ t.optional }}</span>
          <a :href="link('/guide/ebpf-observer')">eBPF Observer</a>
          <span class="topology-sub">{{ t.ebpfDesc }}</span>
        </div>
      </div>

      <div class="topology-edge is-primary">
        <svg class="topology-arrow" viewBox="0 0 56 12" aria-hidden="true"><path d="M0 6h52M46 1l6 5-6 5" /></svg>
        <p><code>HTTPS :3001</code><strong>{{ t.outbound }}</strong></p>
      </div>

      <div class="topology-zone">
        <p class="topology-place"><svg class="topology-icon" viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in icons.server" :key="d" :d="d" /></svg>{{ t.dash }}</p>
        <div class="topology-chip is-focal">
          <svg class="topology-icon" viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in icons.monitoring" :key="d" :d="d" /></svg>
          <strong>Web</strong>
          <span class="topology-sub">{{ t.webDesc }}</span>
          <ul>
            <li><a :href="link('/guide/uptime-monitors')">{{ t.uptime }}</a><span class="topology-sub">{{ t.uptimeDesc }}</span></li>
            <li><a :href="link('/guide/monitoring-setup') + '#direct-otel'">{{ t.otel }}</a><span class="topology-sub">{{ t.otelDesc }}</span></li>
          </ul>
        </div>
      </div>

      <div class="topology-edge">
        <svg class="topology-arrow" viewBox="0 0 56 12" aria-hidden="true"><path d="M0 6h52M46 1l6 5-6 5" /></svg>
        <p><code>HTTPS</code>{{ t.alert }}</p>
      </div>

      <div class="topology-zone">
        <p class="topology-place"><a :href="link('/guide/notifications')">{{ t.channels }}</a></p>
        <div class="topology-chip is-existing">
          <svg class="topology-icon" viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in icons.bell" :key="d" :d="d" /></svg>
          <strong class="topology-names"><span>Telegram</span> <span>Discord</span> <span>Slack</span></strong>
        </div>
      </div>
    </div>
    <figcaption>{{ t.caption }}</figcaption>
  </figure>
</template>
