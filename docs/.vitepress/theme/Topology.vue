<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

// 무엇이 어느 서버에 설치되고 연결이 어느 방향으로 생기는지 보여 주는 배치 구성도. 홈(히어로 아래)과 소개 페이지에서 쓴다.
// 이미지가 아니라 텍스트라서 스크린 리더가 그대로 읽고, 폭이 좁으면(컨테이너 640px 미만) 세로로 쌓인다.
// 문법은 diagram-design skill의 deployment 유형을 따른다: 서버 = 점선 영역, 설치되는 것 = 칩, 연결 = 프로토콜·포트.
// 근거: 설치기 Compose(agent_installer.go)는 호스트 포트를 열지 않는다. eBPF Observer는 API 요청 수집을 고를 때만 설치된다.
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
        <p class="topology-place">{{ t.host }} <span>{{ t.hostNote }}</span></p>
        <div class="topology-chip is-existing">
          <span class="topology-tag">{{ t.existing }}</span>
          <strong>{{ t.app }}</strong>
          <span class="topology-sub">{{ t.appDesc }}</span>
        </div>
        <div class="topology-chip">
          <a :href="link('/reference/collector')">Docker Collector</a>
          <span class="topology-sub">{{ t.collectorDesc }}</span>
        </div>
        <div class="topology-chip is-optional">
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
        <p class="topology-place">{{ t.dash }}</p>
        <div class="topology-chip is-focal">
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
        <p>{{ t.alert }}</p>
      </div>

      <div class="topology-zone">
        <p class="topology-place"><a :href="link('/guide/notifications')">{{ t.channels }}</a></p>
        <div class="topology-chip is-existing">
          <strong class="topology-names"><span>Telegram</span> <span>Discord</span> <span>Slack</span></strong>
        </div>
      </div>
    </div>
    <figcaption>{{ t.caption }}</figcaption>
  </figure>
</template>
