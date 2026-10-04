---
layout: home

hero:
  name: EveryUp
  text: Docker 서비스 모니터링
  tagline: 셀프호스팅 대시보드와 가벼운 Docker Collector로 업타임, 로그, 인프라, API를 한곳에서 확인합니다. 대형 모니터링 스택은 필요 없습니다.
  actions:
    - theme: brand
      text: Quick Start
      link: /guide/quickstart
    - theme: alt
      text: 라이브 데모
      link: https://ai-turn.github.io/everyup/demo/
    - theme: alt
      text: GitHub
      link: https://github.com/ai-turn/everyup

carousel:
  - title: 개요
    caption: 지금 확인이 필요한 서비스와 모니터링 범위, 최근 장애 이력을 한 화면에서 봅니다.
    image: overview
    alt: EveryUp 개요 화면. 확인이 필요한 서비스로 장애가 난 payment-worker, Docker 환경 2개·업타임 모니터 2개·직접 연결 서비스 3개·인프라 리소스 2개의 모니터링 범위, 최근 장애 이력 3건.
  - title: 업타임
    caption: Docker 컨테이너와 HTTP·TCP 대상의 상태를 보고, 장애가 난 대상을 바로 찾습니다.
    image: uptime
    alt: 업타임 화면. 정상 3, 장애 1, 일시정지·대기 1 요약과 모니터링 대상 5개 카드.
  - title: 로그
    caption: 서비스별 오류·경고 추이와 자주 반복되는 오류를 함께 봅니다.
    image: logs
    alt: 로그 화면. 서비스별 ERROR·WARN 건수와 추이, 자주 발생한 오류 목록.
  - title: 인프라
    caption: 호스트 CPU·메모리·디스크·네트워크를 추이와 알림 임계선과 함께 봅니다.
    image: infra
    alt: edge-host-01 인프라 화면. CPU 42%, 메모리 68%, 디스크 89%(위험), 네트워크 18 MB/s 타일과 CPU·메모리·디스크 I/O·네트워크 추이 차트.
  - title: API 요청
    caption: 요청 수, 에러율, 지연 시간 p95를 지난주 추이와 배포 시점까지 겹쳐 봅니다.
    image: api
    alt: api 서비스의 API 요청 탭. 10분 단위 요청 수와 에러 막대, 지난주 점선, 배포 표시가 있는 요청 추이 차트, 지연 시간 p95 121ms, 최근 요청 목록.
  - title: 트레이스
    caption: 실패한 요청의 span과 마스킹된 요청·응답 바디, 관련 로그를 한 패널에서 봅니다.
    image: trace
    alt: 결제 요청 트레이스 패널. SERVER·CLIENT span 오류, 마스킹된 요청 JSON과 upstream_timeout 응답, 503 API 요청, 관련 오류 로그 2건.
  - title: 알림
    caption: Telegram·Discord·Slack 채널과 알림 규칙을 관리하고, 발송 성공률과 실패 이력을 확인합니다.
    image: alerts
    alt: 알림 화면. 7일 발송 178건, 실패 9건, 성공률 95%와 Telegram·Discord·Slack 채널 목록.

features:
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v3h2V6h16v3h2V6c0-1.1-.9-2-2-2m0 14H4v-3H2v3c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-3h-2z"/><path d="M14.89 7.55c-.34-.68-1.45-.68-1.79 0L10 13.76l-1.11-2.21A.988.988 0 0 0 8 11H2v2h5.38l1.72 3.45c.18.34.52.55.9.55s.72-.21.89-.55L14 10.24l1.11 2.21c.17.34.51.55.89.55h6v-2h-5.38z"/></svg>'
    title: 업타임·인프라·로그
    details: Docker 컨테이너의 실행 상태와 health, 호스트 CPU·메모리·디스크·네트워크, 컨테이너 stdout/stderr 로그를 앱 수정 없이 수집합니다.
    link: /guide/introduction#docker-collector
    linkText: 수집 데이터 보기
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="m20.38 8.57-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44z"/><path d="M10.59 15.41a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83"/></svg>'
    title: API latency·트레이스
    details: 자동 eBPF Observer가 앱 수정 없이 실제 latency와 트레이스를 수집합니다.
    link: /guide/ebpf-observer
    linkText: 가이드 보기
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M4 7v2c0 .55-.45 1-1 1H2v4h1c.55 0 1 .45 1 1v2c0 1.65 1.35 3 3 3h3v-2H7c-.55 0-1-.45-1-1v-2c0-1.3-.84-2.42-2-2.83v-.34C5.16 11.42 6 10.3 6 9V7c0-.55.45-1 1-1h3V4H7C5.35 4 4 5.35 4 7m17 3c-.55 0-1-.45-1-1V7c0-1.65-1.35-3-3-3h-3v2h3c.55 0 1 .45 1 1v2c0 1.3.84 2.42 2 2.83v.34c-1.16.41-2 1.52-2 2.83v2c0 .55-.45 1-1 1h-3v2h3c1.65 0 3-1.35 3-3v-2c0-.55.45-1 1-1h1v-4z"/></svg>'
    title: 헤더·바디 상세 수집
    details: OpenTelemetry 연동으로 요청이 실패한 이유까지 진단합니다. 앱은 한 번만 재시작하면 됩니다.
    link: /guide/otel-instrumentation
    linkText: 가이드 보기
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2m6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5z"/></svg>'
    title: 알림
    details: Telegram·Discord·Slack 채널로 장애를 알립니다.
    link: /guide/notifications
    linkText: 가이드 보기
---
