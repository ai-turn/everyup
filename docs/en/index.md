---
layout: home

hero:
  name: EveryUp
  text: 'Predictable systems<br>start with thorough preparation'
  tagline: See uptime, error logs, API response times, and server resources on one screen, and get alerted as soon as anything crosses a threshold.
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

carousel:
  - title: Overview
    caption: The services that need attention, your monitoring scope, and recent incidents on one screen.
    image: overview
    alt: The EveryUp overview. payment-worker flagged as down, a monitoring scope of 2 Docker environments, 2 uptime monitors, 3 directly connected services and 2 infrastructure resources, and 3 recent incidents.
  - title: Uptime
    caption: The state of Docker containers and HTTP/TCP targets, so you can spot the one that is down.
    image: uptime
    alt: The uptime screen. Summary of 3 healthy, 1 down, 1 paused or pending, and cards for 5 monitored targets.
  - title: Logs
    caption: Error and warning trends per service, plus the errors that keep repeating.
    image: logs
    alt: The logs screen. ERROR and WARN counts and trends per service, and a list of frequent errors.
  - title: Infrastructure
    caption: Host CPU, memory, disk, and network with their trends and alert thresholds.
    image: infra
    alt: The infrastructure screen for edge-host-01. Tiles for CPU 42%, memory 68%, disk 89% (critical), network 18 MB/s, and CPU, memory, disk I/O, and network trend charts.
  - title: API requests
    caption: Request count, error rate, and p95 latency against last week and deploy markers.
    image: api
    alt: The API requests tab of the api service. A request trend chart with request and error bars per 10 minutes, a dashed last-week line and a deploy marker, p95 latency of 121 ms, and recent requests.
  - title: Traces
    caption: A failed request's spans, masked request and response bodies, and related logs in one panel.
    image: trace
    alt: The trace panel for a payment request. SERVER and CLIENT spans in error, a masked request JSON and an upstream_timeout response, the API request that ended in 503, and 2 related error logs.
  - title: Notifications
    caption: Telegram, Discord, and Slack channels and alert rules, with delivery success and failures.
    image: alerts
    alt: The alerts screen. 178 sent and 9 failed in 7 days, 95% success, and the Telegram, Discord, and Slack channels.

features:
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v3h2V6h16v3h2V6c0-1.1-.9-2-2-2m0 14H4v-3H2v3c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-3h-2z"/><path d="M14.89 7.55c-.34-.68-1.45-.68-1.79 0L10 13.76l-1.11-2.21A.988.988 0 0 0 8 11H2v2h5.38l1.72 3.45c.18.34.52.55.9.55s.72-.21.89-.55L14 10.24l1.11 2.21c.17.34.51.55.89.55h6v-2h-5.38z"/></svg>'
    title: Uptime, infrastructure, logs
    details: Collects container state and health, host CPU, memory, disk, and network, and container stdout/stderr with no app changes.
    link: /en/guide/introduction#docker-collector
    linkText: See what is collected
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="m20.38 8.57-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44z"/><path d="M10.59 15.41a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83"/></svg>'
    title: API latency & traces
    details: The automatic eBPF Observer records real latency and traces with no app changes.
    link: /en/guide/ebpf-observer
    linkText: Read the guide
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M4 7v2c0 .55-.45 1-1 1H2v4h1c.55 0 1 .45 1 1v2c0 1.65 1.35 3 3 3h3v-2H7c-.55 0-1-.45-1-1v-2c0-1.3-.84-2.42-2-2.83v-.34C5.16 11.42 6 10.3 6 9V7c0-.55.45-1 1-1h3V4H7C5.35 4 4 5.35 4 7m17 3c-.55 0-1-.45-1-1V7c0-1.65-1.35-3-3-3h-3v2h3c.55 0 1 .45 1 1v2c0 1.3.84 2.42 2 2.83v.34c-1.16.41-2 1.52-2 2.83v2c0 .55-.45 1-1 1h-3v2h3c1.65 0 3-1.35 3-3v-2c0-.55.45-1 1-1h1v-4z"/></svg>'
    title: Header & body capture
    details: OpenTelemetry instrumentation shows why a request failed. It takes one app restart.
    link: /en/guide/otel-instrumentation
    linkText: Read the guide
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2m6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5z"/></svg>'
    title: Notifications
    details: Get incident alerts in Telegram, Discord, or Slack.
    link: /en/guide/notifications
    linkText: Read the guide
---
