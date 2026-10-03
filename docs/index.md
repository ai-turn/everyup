---
layout: home

hero:
  name: EveryUp
  text: Docker 서비스 모니터링
  tagline: 셀프호스팅 대시보드와 가벼운 Docker Collector. 큰 관측 스택 없이 업타임·로그·인프라·API를 한곳에서.
  image:
    src: /images/logo.webp
    alt: EveryUp
  actions:
    - theme: brand
      text: 빠른 시작
      link: /guide/quickstart
    - theme: alt
      text: 라이브 데모
      link: https://ai-turn.github.io/everyup/demo/
    - theme: alt
      text: GitHub
      link: https://github.com/ai-turn/everyup

features:
  - icon: 💓
    title: 업타임
    details: Docker 컨테이너를 자동으로 발견하고 실행 상태와 health를 추적합니다.
    link: /guide/introduction
  - icon: 🖥️
    title: 인프라
    details: 호스트 CPU·메모리·디스크·네트워크 메트릭을 수집합니다.
    link: /guide/introduction
  - icon: 📜
    title: 로그
    details: 컨테이너 stdout/stderr를 앱 수정 없이 수집합니다.
    link: /guide/introduction
  - icon: ⚡
    title: API latency·트레이스
    details: 자동 eBPF Observer가 앱 수정 없이 실제 latency와 trace를 만듭니다.
    link: /guide/ebpf-observer
  - icon: 🔍
    title: API 헤더·바디
    details: OpenTelemetry 연동으로 요청이 실패한 이유까지 진단합니다. 앱 재시작 한 번.
    link: /guide/otel-instrumentation
  - icon: 🔔
    title: 알림
    details: Telegram·Discord·Slack 채널로 장애를 알립니다.
    link: /guide/notifications
---

![EveryUp 대시보드](/images/everyup-main-ko.png)
