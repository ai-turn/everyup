# 헤더·바디 상세 수집

서비스 health, 로그, 호스트 메트릭, API **상태코드**는 앱을 수정하지 않아도 수집됩니다.
[자동 eBPF Observer](./ebpf-observer)를 쓰면 코드 없이 실제 **latency와 트레이스**까지 볼 수
있습니다. 이 문서에서는 요청/응답 **헤더·바디**를 OpenTelemetry로 수집하는 방법을 다룹니다.
EveryUp에서 앱을 직접 건드려야 하는 단계는 이것 하나뿐입니다.

앱의 span은 Docker Collector의 OTLP 게이트웨이(`http://everyup-agent:4318`)로 보내거나
Web의 `/api/v1/otlp/v1/traces`로 직접 보냅니다. 게이트웨이로 보내면 Collector가 span을
알맞은 서비스에 연결해 Web으로 전달합니다.
Docker 탐지가 꺼진 Collector 프로필에서는 앱마다 서비스별 bearer 토큰을
보내야 합니다. 발급 방법은 [네트워킹 안내](../reference/collector#networking)를 참고하세요.

## 번들 자동 설정 (Java, Node.js)

Java와 Node.js 서비스는 코드를 한 줄도 쓰지 않고 설정할 수 있습니다. Docker Collector를
설치할 때 `everyup-otel` CLI와 OpenTelemetry 번들(Java agent jar, Node.js 부트스트랩)이
함께 준비됩니다.

1. Web에서 **Docker 환경**을 열고 **상세 수집 설정**을 선택합니다.
2. Compose 프로젝트와 적용할 Java·Node.js 서비스를 체크박스로 선택합니다. 처음에는 아무것도 선택되어 있지 않습니다.
3. 애플리케이션 Compose 경로와 바디 수집 여부를 입력하고 **변경 사항 확인**을 누릅니다.
4. 재시작 대상과 추가되는 설정을 확인하고 **서버 변경 미리보기** 명령을 실행합니다.
5. 실제 Compose 검증이 통과하면 **안전 적용 명령**을 실행하고 Web의 **상세 수집 적용 결과**를 확인합니다.

`everyup-otel plan ./docker-compose.yml --project=shop api=node`는 선택한 서비스의
실행 상태, Compose 프로젝트, 생성할 설정을 검증하고 재시작 범위를 출력합니다.
이 명령은 앱 설정, 컨테이너, 볼륨, 네트워크를 바꾸지 않습니다. 선택하지 않은 서비스의 기존
설정은 다음에 적용할 때도 유지됩니다. 여러 CLI가 같은 Compose를 동시에 변경하지 못하도록
잠금을 겁니다.

CLI는 원본 Compose를 수정하지 않고 옆에 `docker-compose.everyup.yml`을 생성합니다.
선택한 서비스만 다시 만들고, 기존 `JAVA_TOOL_OPTIONS`/`NODE_OPTIONS`, 번들 볼륨,
Docker Collector 연결 네트워크와 컨테이너 health를 검증합니다. 검증에 실패하면 직전 설정으로
자동 복구합니다. 다음 명령으로 직접 확인하고 복구할 수도 있습니다.

```bash
sudo everyup-otel status ./docker-compose.yml
sudo everyup-otel verify ./docker-compose.yml
sudo everyup-otel rollback ./docker-compose.yml
```

Web에서 만든 적용 명령에는 `--report=<Docker 환경 ID>/<실행 ID>`가 들어 있어 실행 결과가
Web으로 전송됩니다. 실행 계획은 발급 후 1시간 안에 시작해야 하며, 이미 완료된 계획으로는
다시 적용할 수 없습니다. 결과를 보낼 때는 해당 서버의 `everyup-agent` 컨테이너에 저장된
Web 주소와 API Key를 사용하므로, 키가 브라우저에 표시되는 명령이나 실행 결과에 포함되지
않습니다. Web이 실행 시작을 승인하지 않으면 앱을 변경하지 않습니다. 결과 전송에 실패하면
CLI 출력을 확인하세요.

Web은 **설정 적용 검증 완료**와 **실행 시작 이후 새 트레이스 수신**을 따로 표시합니다.
새 트레이스에는 eBPF 같은 다른 경로로 들어온 것도 섞여 있으므로, 새 트레이스가 들어왔다는
사실만으로 헤더·바디 수집이 성공했다고 판단하지 않습니다. 트래픽이 없어 트레이스가 들어오지
않더라도 자동 복구는 하지 않습니다. 자동·수동 롤백의 성공 여부도 실행 기록에 남으며, 최근
실행 기록은 화면을 다시 열어도 볼 수 있습니다. 서버에서 따로 실행하는 `verify`·`status`
명령은 로컬 상태만 확인합니다.

바디 수집은 기본으로 꺼져 있으며, 자동 설정으로 켤 수 있는 것은 Node.js뿐입니다.

### 헬퍼가 하는 일

`everyup-otel` 헬퍼는 Docker Collector를 한 줄 설치기로 설치할 때 `/usr/local/bin/everyup-otel`에
함께 설치됩니다. 적용 명령을 실행하면 헬퍼는 다음 순서로 동작합니다.

- 바꾸기 전에 Linux, Docker, 기본 Compose 파일, 대상 런타임, 실행 중인 컨테이너를 검증합니다.
- 공유 네트워크 `everyup-monitoring`을 만들고, Docker Collector 이미지에서
  `everyup-instrumentation` 볼륨을 채웁니다.
- 기존 `JAVA_TOOL_OPTIONS`·`NODE_OPTIONS`를 유지한 채 원본 Compose 옆에 관리용
  `docker-compose.everyup.yml`을 씁니다.
- 선택한 서비스만 다시 만들고 health, 주입 옵션, 읽기 전용 `/everyup` 마운트, Collector
  네트워크 연결을 확인합니다.
- 재시작이나 검증이 실패하면 이전 설정으로 자동 복구하고 다시 만듭니다.

롤백 정보는 앱 Compose 디렉터리의 `.everyup` 폴더에 보관합니다. 헬퍼가 앱과 Docker
Collector를 `everyup-monitoring` 네트워크에 연결하므로 OTLP 포트를 외부에 열지 않아도
`everyup-agent:4318`로 접근할 수 있습니다. 기존 `JAVA_TOOL_OPTIONS`·`NODE_OPTIONS` 값은
유지되고 EveryUp 옵션은 한 번만 덧붙습니다. 지원 버전은 JVM 8+, Node 18.19+ 또는 20.6+입니다.

아래 내용은 다른 언어를 쓰거나, SDK를 직접 설정하거나, 번들이 만드는 span의 형식을
알고 싶을 때 참고하세요.

## EveryUp이 span에서 읽는 것

서비스의 **API 요청** 탭에 요청이 표시되려면, 요청마다 **SERVER** 종류의 span에 아래 attribute를
담아 보내야 합니다.

| Attribute | 타입 | 용도 |
| --- | --- | --- |
| `http.request.method` (또는 `http.method`) | string | 필수. 요청 메서드 |
| `http.response.status_code` (또는 `http.status_code`) | int | 필수. 상태코드 |
| `url.path` (또는 `http.target`) | string | 요청 경로 |
| `http.route` | string | 선택. 경로 템플릿 (예: `/users/:id`) |
| `client.address` (또는 `net.peer.ip`) | string | 선택. 클라이언트 IP |

메서드나 상태코드가 없는 span은 API 요청으로 집계하지 않습니다. 요청의 latency는 span
duration을 그대로 쓰며, 1ms 미만은 1ms로 올립니다.

## 헤더

헤더는 표준 OTel span attribute인 `http.request.header.<이름>`과
`http.response.header.<이름>`에 담겨 Trace 패널의 **Headers** 섹션에 표시됩니다. 캡처할
헤더는 언어마다 다음과 같이 allowlist로 지정합니다.

| 언어 | 방법 |
| --- | --- |
| Java (agent jar) | `OTEL_INSTRUMENTATION_HTTP_SERVER_CAPTURE_REQUEST_HEADERS=content-type,user-agent` (응답 헤더는 `..._CAPTURE_RESPONSE_HEADERS`) |
| Node (EveryUp 번들) | `OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_REQUEST=content-type,user-agent` (응답 헤더는 `..._SERVER_RESPONSE`) |
| Python (`opentelemetry-instrument`) | `OTEL_INSTRUMENTATION_HTTP_CAPTURE_HEADERS_SERVER_REQUEST=content-type,user-agent` |
| 기타 / 수동 SDK | SERVER span에 attribute를 직접 설정 |

민감한 헤더(`authorization`, `cookie`, `set-cookie`, `x-api-key` 등)는 **어떤 설정으로
캡처하든** 수집 단계에서 마스킹합니다. 하이픈(`-`)과 언더스코어(`_`) 표기를 모두 인식합니다.

## 요청/응답 바디 (span 이벤트)

바디에 해당하는 표준 span attribute가 없으므로, 요청 span에 **이벤트**로 담습니다.

- 이벤트 이름은 **`request_body_masked`**와 **`response_body_masked`**입니다. 둘 중 하나만 보내도 됩니다.
- 각 이벤트의 `body` attribute에는 **이미 마스킹한** 본문을 담습니다. 시크릿, 토큰, 개인정보는
  export하기 전에 앱에서 제거하세요. 선택 attribute로 `body_size`(int)와 `body_truncated`(bool)를 쓸 수 있습니다.
- 바디는 작게 유지하세요(번들 기본값 8KiB). Web은 64KiB까지만 저장하고, 넘는 부분은 잘라서
  truncated로 표시합니다.

수집된 바디는 **admin만** 볼 수 있습니다. Web은 admin이 아닌 사용자에게 `body` attribute를
가리고, admin이 바디를 열람할 때마다 `audit_events`에 기록합니다. 바디는
`EVERYUP_RETENTION_BODYCAPTUREDAYS`일(기본 7일)이 지나면 지우고, 트레이스는 남깁니다.

### Node.js

EveryUp 번들이 처리하므로 코드를 고칠 필요가 없습니다. `EVERYUP_CAPTURE_BODIES=true`만
설정하면 되고, `EVERYUP_BODY_MAX_BYTES`와 `EVERYUP_MASKED_BODY_FIELDS`로 최대 크기와
마스킹할 필드를 조정할 수 있습니다.

### Java (Spring Boot 예시)

OTel Java agent는 바디를 캡처하지 않으므로, 바디를 현재 span에 넣는 작은 필터를 추가합니다.

```java
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.Span;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

@Component
public class BodyCaptureFilter extends OncePerRequestFilter {
    private static final int MAX = 8192;
    private static final AttributeKey<String> BODY = AttributeKey.stringKey("body");

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        var reqW = new ContentCachingRequestWrapper(req, MAX);
        var resW = new ContentCachingResponseWrapper(res);
        try {
            chain.doFilter(reqW, resW);
        } finally {
            Span span = Span.current();
            span.addEvent("request_body_masked",
                Attributes.of(BODY, mask(new String(reqW.getContentAsByteArray(), StandardCharsets.UTF_8))));
            span.addEvent("response_body_masked",
                Attributes.of(BODY, mask(new String(resW.getContentAsByteArray(), StandardCharsets.UTF_8))));
            resW.copyBodyToResponse();
        }
    }

    // export 전에 시크릿을 마스킹 — 필요한 필드명으로 확장하세요.
    private String mask(String body) {
        return body.replaceAll("(\"(?:password|token|secret|apiKey)\"\\s*:\\s*\")[^\"]*", "$1***");
    }
}
```

### Python (FastAPI/Starlette 예시)

```python
import json, re
from opentelemetry import trace

MASKED = re.compile(r'("(?:password|token|secret|api_key)"\s*:\s*")[^"]*')

@app.middleware("http")
async def capture_request_body(request, call_next):
    body = await request.body()  # Starlette이 캐시하므로 핸들러도 계속 읽을 수 있음
    response = await call_next(request)
    span = trace.get_current_span()
    if span.is_recording() and body:
        text = body[:8192].decode("utf-8", "replace")
        span.add_event("request_body_masked", {"body": MASKED.sub(r"\1***", text)})
    return response
```

Starlette에서 스트리밍 응답의 바디를 캡처하는 것은 더 복잡하므로, 요청 바디부터 수집하세요.

## 로그를 요청에 연결하기

Trace 패널은 같은 **trace id**를 가진 로그와 span을 한 요청으로 묶어 보여줍니다.
애플리케이션 로그를 이 패널에 표시하려면 다음과 같이 합니다.

- **OTLP 로그를 쓰는 경우**(SDK 로그 exporter): 트레이스되는 요청 안에서 남긴 로그에는
  trace id가 자동으로 들어가므로 따로 할 일이 없습니다.
- **일반 stdout 로그를 쓰는 경우**(Docker Collector가 수집): 각 로그 줄에 trace id나,
  `x-request-id` 헤더로 전파하는 `request_id`를 출력하세요. 그 id로 검색하면 로그를 요청과
  연결할 수 있습니다.

바디 캡처를 꺼 둔 서비스도 이 방법으로 요청과 응답 내용을 확인할 수 있습니다. 바디가 서비스
로그에 남아 있다면 공유 id로 찾아 요청과 연결하면 됩니다.

## 중복 집계

중복 집계는 자동으로 막습니다. 어떤 서비스가 Docker Collector 게이트웨이로 실제 span을 보내는
동안에는, Collector가 그 서비스의 access log로 만든 합성 span을 보내지 않습니다. 실제 span이
끊기고 약 10분이 지나면 다시 보냅니다.

다만 게이트웨이를 거치지 않고 **Web으로 직접** OTLP를 보내는 앱은 중복으로 집계될 수 있으므로,
게이트웨이로 보내도록 설정하세요.
