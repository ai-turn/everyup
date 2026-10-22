# Automatic eBPF Observer

The Docker Collector's access-log parser reads method, path, and status without extracting response
times. When you select API collection, the bundled Compose file starts `everyup-ebpf` to collect
real response times and traces.
It discovers processes running in Docker/OCI containers, so there is no
`BEYLA_OPEN_PORT` or application port configuration.

This does not change your app code, Dockerfile, or app containers. On a native
Linux host, eBPF observes host processes to build traces and the Docker Collector
attributes each span to the matching Docker service. Docker Desktop has the
PID-translation limitation, so use [app-side OpenTelemetry](./otel-instrumentation)
when automatic service attribution is unavailable. The kernel and permission requirements are
under [Notes](#notes).

## How it works

The Compose bundle starts an `everyup-ebpf` service using
[OpenTelemetry eBPF Instrumentation (OBI)](https://opentelemetry.io/docs/zero-code/obi/).
It captures real SERVER spans (method, path, status, **latency**) on the supported
runtimes, including Go and HTTPS. A span records one operation in a request's trace.

OBI sends spans to the Docker Collector's OTLP gateway, tagged
`everyup.source=ebpf`. The Collector maps each span to a service by the
instrumented process's PID (via Docker) and renames it accordingly; spans it
cannot match — host processes, the Observer itself, or stale PIDs — are dropped
so they never appear as phantom services. Services covered by real spans stop
receiving synthetic access-log spans automatically (no double counting).

## Cross-service trace correlation

Collecting API spans and connecting calls across services into one distributed trace are separate
capabilities. The installer-generated bundle disables the advanced cross-service option by default.
Open an environment from **Docker 환경** (Docker environments), then check **모니터링 설정 가이드**
(monitoring setup guide) for automatic API tracing and cross-service correlation status separately.

The Collector's correlation diagnostic additionally checks whether the option is enabled, whether
Linux is 5.17 or newer, and the kernel Lockdown state. Passing these checks does not guarantee
correlation for every runtime.

## Notes {#notes}

- The Collector's host diagnostic checks amd64 or arm64, Linux kernel 5.8 or newer, and BTF
  (`/sys/kernel/btf/vmlinux`). RHEL-family kernels with 4.18 or newer backports are also included
  in the diagnostic. A Docker Desktop VM can pass the kernel checks and still have the PID
  attribution limitation described above.
- `privileged` + `pid: host` are required by this simple eBPF deployment. The
  elevated Observer is kept separate from the regular Docker Collector. Remove it if that
  is not acceptable for your host; everything else keeps working.
- The default OBI policy does not capture headers or bodies. Use
  [app-side OpenTelemetry](./otel-instrumentation) for the current EveryUp deep-inspection flow.
- A service freshly (re)started may drop its first seconds of spans until the
  Collector's next PID refresh (one check interval).
- OBI is pinned to a tested release in the Compose file. Upgrade it only after
  validating the target kernel and the PID attribution contract.
