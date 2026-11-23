---
layout: home

hero:
  name: EveryUp · Self-hosted monitoring
  text: Service health and errors in one place
  tagline: 'Monitor uptime, logs, API response times, and server resources.<br>Alerts follow your rules. Monitored servers need no inbound ports.<br>The dashboard UI is in Korean.'
  actions:
    - theme: brand
      text: Get started
      link: /en/guide/quickstart
    - theme: alt
      text: Live Demo
      link: https://ai-turn.github.io/everyup/demo/

carousel:
  - title: Overview
    image: overview
    alt: The EveryUp overview. 13 servers, the needs-attention list with 2 outages (Checkout API on edge-host-01 and payment-worker on prod-server) and 6 items needing attention, and 7 recent incidents.
  - title: Uptime
    image: uptime
    alt: The Storefront uptime monitor on the edge-host-01 server. 24h uptime 99.41%, 30-day uptime 99.86%, 130 ms average response, certificate expiry in 83 days, and a 6-hour response-time chart showing a slowdown, a spike and an outage.
  - title: Logs
    image: logs
    alt: The all-logs screen. Error and warning counts and trends over the last 24 hours for 7 apps with their latest log, followed by the frequent errors and warnings.
  - title: Infrastructure
    image: infra
    alt: The infrastructure tab of the edge-host-01 server. Usage trend charts for CPU 67.4%, memory 72.8% (needs attention, threshold 70%) and disk 41.2%, plus network In and Out, with an 80% alert threshold line on the CPU chart.
  - title: API requests
    image: api
    alt: The API requests tab of the api container on the prod-server server. Status code mix, request count, error rate and p95 tiles, a trend chart with request and error bars per 10 minutes and a deploy marker, and a per-endpoint table of requests, error rate and p95.
  - title: Traces
    image: trace
    alt: The trace panel for a payment request. SERVER and CLIENT spans in error (payment gateway timeout, certificate validation failed), a masked request JSON and an upstream_timeout response, and links to the related logs and API request.
  - title: Notifications
    image: alerts
    alt: The alert rules list. 9 rules that can be filtered by uptime, API requests, logs, metrics, infrastructure and system, each with its severity, target, condition and channels.

features:
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v3h2V6h16v3h2V6c0-1.1-.9-2-2-2m0 14H4v-3H2v3c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-3h-2z"/><path d="M14.89 7.55c-.34-.68-1.45-.68-1.79 0L10 13.76l-1.11-2.21A.988.988 0 0 0 8 11H2v2h5.38l1.72 3.45c.18.34.52.55.9.55s.72-.21.89-.55L14 10.24l1.11 2.21c.17.34.51.55.89.55h6v-2h-5.38z"/></svg>'
    title: Stopped services, full disks
    details: The Docker Collector collects container state, logs, and host resources.
    link: /en/guide/introduction#docker-collector
    linkText: See what is collected
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="m20.38 8.57-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44z"/><path d="M10.59 15.41a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83"/></svg>'
    title: Slow APIs
    details: The eBPF Observer collects API response times and traces without app changes.
    link: /en/guide/ebpf-observer
    linkText: Check automatic API collection requirements
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M4 7v2c0 .55-.45 1-1 1H2v4h1c.55 0 1 .45 1 1v2c0 1.65 1.35 3 3 3h3v-2H7c-.55 0-1-.45-1-1v-2c0-1.3-.84-2.42-2-2.83v-.34C5.16 11.42 6 10.3 6 9V7c0-.55.45-1 1-1h3V4H7C5.35 4 4 5.35 4 7m17 3c-.55 0-1-.45-1-1V7c0-1.65-1.35-3-3-3h-3v2h3c.55 0 1 .45 1 1v2c0 1.3.84 2.42 2 2.83v.34c-1.16.41-2 1.52-2 2.83v2c0 .55-.45 1-1 1h-3v2h3c1.65 0 3-1.35 3-3v-2c0-.55.45-1 1-1h1v-4z"/></svg>'
    title: Why a request failed
    details: Capture request and response headers and bodies with OpenTelemetry to find out why a request failed.
    link: /en/guide/otel-instrumentation
    linkText: Set up header and body capture
  - icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2m6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5z"/></svg>'
    title: Incident alerts
    details: When a rule's conditions are met, EveryUp notifies you in Telegram, Discord, or Slack.
    link: /en/guide/notifications
    linkText: Set up notifications
---
