---
layout: home

hero:
  name: EveryUp
  text: Docker service monitoring
  tagline: A self-hosted dashboard with a lightweight Docker Collector. Uptime, logs, infrastructure, and APIs in one place, without a large observability stack.
  image:
    src: /images/logo.webp
    alt: EveryUp
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

features:
  - icon: 💓
    title: Uptime
    details: Automatic Docker container discovery, container state and health.
    link: /en/guide/introduction
  - icon: 🖥️
    title: Infrastructure
    details: Host CPU, memory, disk, and network metrics.
    link: /en/guide/introduction
  - icon: 📜
    title: Logs
    details: Container stdout/stderr collection with no app changes.
    link: /en/guide/introduction
  - icon: ⚡
    title: API latency & traces
    details: The automatic eBPF Observer builds real latency and traces with no app changes.
    link: /en/guide/ebpf-observer
  - icon: 🔍
    title: API headers & bodies
    details: OpenTelemetry instrumentation shows why a request failed. One app restart.
    link: /en/guide/otel-instrumentation
  - icon: 🔔
    title: Notifications
    details: Telegram, Discord, and Slack channels.
    link: /en/guide/notifications
---

![EveryUp dashboard](/images/everyup-main-en.png)
