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

showcaseTitle: 주요 기능
showcase:
  - title: 업타임
    details: Docker 컨테이너와 HTTP·TCP 대상의 상태를 한눈에 보고, 장애가 난 대상을 바로 찾습니다.
    link: /guide/quickstart
    linkText: Quick Start로 시작하기
    image: uptime
    alt: 업타임 화면. 정상 3, 장애 1, 일시정지·대기 1 요약과 모니터링 대상 5개 카드.
  - title: 로그
    details: 컨테이너 stdout/stderr를 앱 수정 없이 모읍니다. 서비스별 오류·경고 추이와 자주 반복되는 오류를 함께 봅니다.
    link: /guide/introduction#docker-collector
    linkText: 수집 데이터 보기
    image: logs
    alt: 로그 화면. 서비스별 ERROR·WARN 건수와 추이, 자주 발생한 오류 목록.
  - title: 인프라
    details: 호스트 CPU·메모리·디스크·네트워크를 추이와 함께 보고, 임계값을 넘으면 알림을 받습니다.
    link: /reference/collector
    linkText: Collector 설정 보기
    image: infra
    alt: 인프라 화면. CPU 42%, 메모리 68%, 디스크 89%(위험), 네트워크 18 MB/s 타일과 CPU·메모리 추이 차트.
  - title: API latency·트레이스
    details: 요청 수, 에러율, 지연 시간 p95를 지난주 추이와 배포 시점까지 겹쳐 봅니다. 자동 eBPF Observer가 앱 수정 없이 수집합니다.
    link: /guide/ebpf-observer
    linkText: eBPF Observer 알아보기
    image: api
    alt: API 요청 추이 카드. 10분 단위 요청 수 막대와 에러, 지난주 점선, 배포 표시, 지연 시간 p95 121ms.
  - title: 헤더·바디 상세 수집
    details: 실패한 요청의 마스킹된 요청·응답 바디와 응답 코드를 트레이스에서 바로 확인합니다. 앱은 한 번만 재시작하면 됩니다.
    link: /guide/otel-instrumentation
    linkText: 헤더·바디 수집 설정
    image: trace
    alt: 트레이스 패널의 캡처된 바디. 마스킹된 결제 요청 JSON, upstream_timeout 응답, 503으로 끝난 API 요청.
  - title: 알림
    details: Telegram·Discord·Slack 채널과 알림 규칙을 관리하고, 발송 성공률과 실패 이력을 확인합니다.
    link: /guide/notifications
    linkText: 알림 채널 설정
    image: alerts
    alt: 알림 화면. 7일 발송 178건, 실패 9건, 성공률 95%와 Telegram·Discord·Slack 채널 목록.
---
