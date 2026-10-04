---
layout: home

hero:
  name: EveryUp
  text: Docker service monitoring
  tagline: A self-hosted dashboard with a lightweight Docker Collector. Uptime, logs, infrastructure, and APIs in one place, without a large observability stack.
  actions:
    - theme: brand
      text: Quick Start
      link: /en/guide/quickstart
    - theme: alt
      text: Live Demo
      link: https://ai-turn.github.io/everyup/demo/
    - theme: alt
      text: GitHub
      link: https://github.com/ai-turn/everyup

showcaseTitle: Features
showcase:
  - title: Uptime
    details: See the state of Docker containers and HTTP/TCP targets at a glance, and spot the one that is down.
    link: /en/guide/quickstart
    linkText: Start with the Quick Start
    image: uptime
    alt: The uptime screen. Summary of 3 healthy, 1 down, 1 paused, and cards for 5 monitored targets.
  - title: Logs
    details: Collects container stdout/stderr with no app changes. Error and warning trends per service, plus the errors that keep repeating.
    link: /en/guide/introduction#docker-collector
    linkText: See what is collected
    image: logs
    alt: The logs screen. ERROR and WARN counts and trends per service, and a list of frequent errors.
  - title: Infrastructure
    details: Host CPU, memory, disk, and network with their trends, and an alert when a threshold is crossed.
    link: /en/reference/collector
    linkText: Collector configuration
    image: infra
    alt: The infrastructure screen. Tiles for CPU 42%, memory 68%, disk 89% (critical), network 18 MB/s, and CPU and memory trend charts.
  - title: API latency & traces
    details: Request count, error rate, and p95 latency against last week and deploy markers. The automatic eBPF Observer records it with no app changes.
    link: /en/guide/ebpf-observer
    linkText: About the eBPF Observer
    image: api
    alt: The API request trend card. Request bars per 10 minutes with errors, a dashed last-week line, a deploy marker, and p95 latency of 121 ms.
  - title: Header & body capture
    details: Open a failed request's trace to see its masked request and response bodies and the status code. It takes one app restart.
    link: /en/guide/otel-instrumentation
    linkText: Set up header & body capture
    image: trace
    alt: Captured bodies in the trace panel. A masked payment request JSON, an upstream_timeout response, and the API request that ended in 503.
  - title: Notifications
    details: Manage Telegram, Discord, and Slack channels and alert rules, and check delivery success and failures.
    link: /en/guide/notifications
    linkText: Set up notification channels
    image: alerts
    alt: The alerts screen. 178 sent and 9 failed in 7 days, 95% success, and the Telegram, Discord, and Slack channels.
---
