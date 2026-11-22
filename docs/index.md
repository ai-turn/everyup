---
layout: home

hero:
  name: EveryUp · 셀프호스팅 모니터링
  text: 서비스 상태와 오류를 한곳에서
  tagline: '업타임·로그·API 응답 시간·서버 자원을 확인하고 알림을 받으세요.<br>모니터링할 서버에는 인바운드 포트를 열지 않아도 됩니다.'
  actions:
    - theme: brand
      text: 시작하기
      link: /guide/quickstart
    - theme: alt
      text: 라이브 데모
      link: https://ai-turn.github.io/everyup/demo/

carousel:
  - title: 개요
    image: overview
    alt: EveryUp 개요 화면. 서버 9개·Docker 환경 4개, 현재 확인 필요 목록(edge-host-01의 Checkout API와 prod-server의 payment-worker 장애 2건, 임계값을 넘은 확인 필요 4건), 최근 장애 이력 7건.
  - title: 업타임
    image: uptime
    alt: edge-host-01 서버의 Storefront 업타임 모니터. 24시간 업타임 99.41%, 30일 업타임 99.86%, 평균 응답 130ms, 인증서 만료 D-83과 지연 증가·스파이크·장애 구간이 보이는 6시간 응답 시간 차트.
  - title: 로그
    image: logs
    alt: 전체 로그 화면. 앱 7개의 최근 24시간 오류·경고 건수와 추이, 최근 로그. 아래에 자주 발생한 오류·경고 목록.
  - title: 인프라
    image: infra
    alt: edge-host-01 서버의 인프라 탭. CPU 67.4%, 메모리 72.8%(확인 필요, 기준 70%), 디스크 41.2% 사용률과 네트워크 In·Out 추이 차트. CPU 차트에 알림 임계선 80%.
  - title: API 요청
    image: api
    alt: prod-server Docker 환경에 있는 api 서비스의 API 요청 탭. 상태 코드 비율, 요청 수·에러율·p95 지표, 10분 단위 요청·에러 막대와 배포 표시가 있는 추이 차트, Endpoint별 요청·에러율·p95 표.
  - title: 트레이스
    image: trace
    alt: 결제 요청 트레이스 패널. SERVER·CLIENT span 오류(payment gateway timeout, certificate validation failed), 마스킹된 요청 JSON과 upstream_timeout 응답, 로그·API 요청 탭으로 이동하는 링크.
  - title: 알림
    image: alerts
    alt: 알림 규칙 목록. 규칙 9개를 업타임·API 요청·로그·메트릭·인프라·시스템으로 거를 수 있고, 규칙마다 심각도·대상·발생 조건·채널을 보여 준다.

features:
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v3h2V6h16v3h2V6c0-1.1-.9-2-2-2m0 14H4v-3H2v3c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-3h-2z"/><path d="M14.89 7.55c-.34-.68-1.45-.68-1.79 0L10 13.76l-1.11-2.21A.988.988 0 0 0 8 11H2v2h5.38l1.72 3.45c.18.34.52.55.9.55s.72-.21.89-.55L14 10.24l1.11 2.21c.17.34.51.55.89.55h6v-2h-5.38z"/></svg>'
    title: 멈춘 서비스, 꽉 찬 디스크
    details: Docker Collector가 컨테이너 상태·로그·호스트 자원을 수집합니다.
    link: /guide/introduction#docker-collector
    linkText: 수집 데이터 보기
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="m20.38 8.57-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44z"/><path d="M10.59 15.41a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83"/></svg>'
    title: 느려진 API
    details: eBPF Observer가 앱 수정 없이 API 응답 시간과 트레이스를 수집합니다.
    link: /guide/ebpf-observer
    linkText: API 자동 수집 조건 보기
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M4 7v2c0 .55-.45 1-1 1H2v4h1c.55 0 1 .45 1 1v2c0 1.65 1.35 3 3 3h3v-2H7c-.55 0-1-.45-1-1v-2c0-1.3-.84-2.42-2-2.83v-.34C5.16 11.42 6 10.3 6 9V7c0-.55.45-1 1-1h3V4H7C5.35 4 4 5.35 4 7m17 3c-.55 0-1-.45-1-1V7c0-1.65-1.35-3-3-3h-3v2h3c.55 0 1 .45 1 1v2c0 1.3.84 2.42 2 2.83v.34c-1.16.41-2 1.52-2 2.83v2c0 .55-.45 1-1 1h-3v2h3c1.65 0 3-1.35 3-3v-2c0-.55.45-1 1-1h1v-4z"/></svg>'
    title: 실패한 요청의 원인
    details: OpenTelemetry로 요청·응답 헤더와 바디를 수집해 실패 원인을 찾습니다.
    link: /guide/otel-instrumentation
    linkText: 헤더·바디 수집 설정하기
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2m6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5z"/></svg>'
    title: 장애 알림
    details: 규칙의 조건을 만족하면 Telegram·Discord·Slack으로 알림을 보냅니다.
    link: /guide/notifications
    linkText: 알림 설정하기
---
