# 알림 메뉴 UI·UX 점검 결과

작성일: 2026-11-13 · 기준: [인프라 점검 계획](infra-menu-ux-evaluation-plan.md)의 방식(약식) · HEAD `353d8070` (제품 코드 변경 없음) · 데모 `http://127.0.0.1:5180/everyup/demo/` (실행 중인 데모 개발 서버 재사용) · Chromium(Playwright)

메트릭 점검과 같은 **약식 점검**이다. 점수는 매기지 않고 심각도(S1 표현 개선, S2 작은 과업 방해, S3 큰 혼동·우회, S4 과업 차단·중대한 결과 오해)만 붙였다. 데스크톱 1440·모바일 390, 라이트·다크에서 세 탭과 규칙·채널 추가 화면을 캡처하고 axe를 돌렸다. 수정 패널, 시스템 규칙, 대상 필터, 채널 테스트, 빈 상태와 조회 일부 실패 시나리오는 데스크톱 라이트에서 따로 확인했다. 데모는 mock 데이터라 저장·발송 경로는 Go 소스(`web/backend/internal/`)로 확인했고, 그렇게 확인한 항목은 근거에 소스 위치를 적었다. 증거는 [`alerts-menu-ux-evaluation-evidence/`](alerts-menu-ux-evaluation-evidence/)에 있다(`audit.mjs`, 스크린샷, json). 화면이 내부 컨테이너에서 스크롤되므로 스크린샷은 첫 화면만 담고, 나머지 글자는 같은 이름의 json `text`에 있다.

대상 화면: `/alerts`의 세 탭(`알림 채널` 기본·`알림 규칙`·`알림 로그`, `AlertsPage` → `AlertsDesktopView`·`AlertsMobileView`), 규칙 추가·수정 사이드 패널(`AlertRulesTab` → `FormSidePanel` + `AlertRuleForm`), 채널 추가·수정(데스크톱 사이드 패널, 모바일 `/alerts/channels/new`·`/:id/edit`의 `ChannelFormPage`), 발송 이력(`NotificationHistoryTab`).

## 1. 요약

- 캡처한 45개 화면 모두 가로 넘침이 없다. axe는 21개 화면에서 돌렸고, 위반은 규칙 추가 패널에만 있다(4개 환경의 `label` critical, 다크의 `color-contrast` serious, 라이트 미리보기의 `color-contrast`, A-15).
- **채널을 편집해 저장하면 Telegram Bot Token이 `***`로 바뀐다(A-01, S4).** 서버가 목록 응답에서 비밀값을 `***`로 가리고, 폼이 그 값을 입력칸에 그대로 넣고, 서버 `Update`가 받은 값을 그대로 저장한다. 이름만 고쳐도 채널이 조용히 끊긴다. Discord·Slack은 `***`가 URL 검증에 걸려 저장이 막힌다.
- **메트릭 규칙은 폼과 목록이 실제 평가와 다르게 말한다(A-02, A-03).** 폼은 지속 시간·쿨다운을 받지만 서버는 수신할 때마다 바로 평가하며 둘 다 쓰지 않는다. 카테고리를 메트릭으로 바꾸면 임계값 칸은 비어 있는데 이전 값 `≥ 400`이 저장된다. 목록에서는 메트릭 규칙이 `헬스체크`로 분류되고 조건이 `otel_metric 100% 초과 · N회 연속`으로 나온다. 어떤 메트릭인지는 보이지 않는다.
- **업타임 모니터에는 개별 알림을 걸 수 없다(A-04).** 규칙 폼의 헬스체크 대상 목록에 업타임 모니터가 없다. 그런데 업타임 상세의 `알림 규칙` 버튼은 그 모니터로 거른 규칙 목록을 연다. TCP 모니터는 소스상 HTTP 상태 조건이 늘 참이라 기본 프리셋으로는 다운을 감지하지 못한다.
- **조회 실패가 빈 상태로 보인다(A-05).** 규칙 탭이 대상 이름까지 한 번에 받다가 하나라도 실패하면 "구성된 알림 규칙이 없습니다"를 띄운다. 이때 탭 숫자는 8이다. 모바일에서는 규칙을 고치거나 지울 수 없고, 무엇을 감시하는지도 `cpu gt 80`처럼 원시값으로만 보인다(A-06).
- 이전 점검에서 미룬 두 가지를 정했다(§5.2). **메트릭 단독 보기에서 알림 규칙 추가는 추가한다.** 지금 규칙 폼은 미리 채울 값을 받는 통로가 없다. URL에서 대상 필터만 읽고, 그 대상조차 `추가`로 넘기지 않는다(A-09). **대상 추가 시 알림 설정은 업타임만 축소해 추가하고, 인프라는 보류한다.**
- severity는 상태와 별개 축으로 두되, 색은 §1.5 로그 레벨과 같은 규칙으로 정리한다. critical·warning은 상태 토큰을 쓰고, info만 sky를 쓴다(A-16). 지금은 같은 severity가 세 곳에서 세 가지 primitive 팔레트로 칠해진다.

## 2. 이슈

| ID | 심각도 | 화면 | 내용 | 근거 | 권장 수정 | 규모 |
| --- | :-: | --- | --- | --- | --- | :-: |
| A-01 | S4 | 채널 수정 (데스크톱·모바일) | 채널 목록 API가 비밀값을 `***`로 가려 보낸다(`MaskConfig`). 폼은 그 값을 그대로 입력칸에 넣는다(Bot Token 입력값 `***`). 서버 `Update`는 받은 설정으로 통째로 덮어쓴다. 그래서 Telegram 채널은 이름만 고쳐 저장해도 Bot Token이 `***`가 되고, 다음 알림부터 조용히 실패한다. 사용자는 장애 때 발송 이력을 보고서야 이를 안다. Discord·Slack은 `***`가 `http(s)://` 검증에 걸려 "Webhook URL은 http:// 또는 https://로 시작해야 합니다"가 나온다. 사용자는 이유를 모른 채 URL을 다시 찾아 넣어야 한다. 데모의 Discord mock은 가려지지 않은 URL이라 이 절반이 재현되지 않는다(A-20). | `channel-edit-telegram-values.json`, `channel-edit-telegram.png`, `ChannelForm.tsx:249-265`, `models/notification.go:52-87`, `handlers/notifications.go:389` | 편집 시 비밀 필드는 빈 칸 + "바꿀 때만 입력합니다" 안내로 두고 `required`에서 뺀다. 서버 `Update`는 비밀 필드가 비었거나 `***`이면 기존 값을 유지한다. 저장 전 테스트도 같은 병합을 거친다 | S |
| A-02 | S3 | 규칙 추가·수정 (메트릭) | 메트릭 규칙은 서버가 수신할 때마다 바로 비교하고 시리즈별 중복 억제로만 거른다. `duration`·`cooldown`은 쓰지 않으며, 폼도 `cooldown`을 0으로 바꿔 보낸다. 그런데 폼은 `지속 시간 (분)`·`쿨다운 (초)`를 받고, 미리보기는 `FOR 10 min · COOLDOWN 900s`를 보여 준다. 카테고리를 메트릭으로 바꾸면 프리셋이 `직접 설정`이 되면서 임계값 칸이 빈다. 하지만 폼 값은 이전 카테고리의 `≥ 400`이 남아 미리보기에 `IF Metric ≥ 400`이 뜨고, 그대로 저장된다. Direct 서비스를 골라도 메트릭 이름 제안(datalist)이 없다. 제안은 Docker 서비스에만 연결돼 있다. | `1440-light-rule-add-metric.png`, `rule-edit-metric.png`, `AlertRuleForm.tsx:323-332`, `:378`, `:410-415`, `:649-660`, `:678-722`, `otlp_ingest.go:70-95` | 메트릭에서는 지속 시간·쿨다운 칸을 빼고 "수신할 때마다 평가합니다. 같은 시리즈는 한 번만 보냅니다"를 둔다. 임계값은 필수로 검증한다(빈 칸이면 제출 불가). 대상이 Direct면 `getObservedServiceOtelMetricNames`로 제안을 채운다 | S |
| A-03 | S3 | 규칙 목록 (메트릭) | 실제 메트릭 규칙은 `type: service` + `metric: otel_metric`이다. `ruleCategory`는 이를 `헬스체크`로 분류한다. 조건은 `metricLabel` 폴백과 `%` 단위, 헬스체크의 `N회 연속`이 섞여 `otel_metric 100% 초과 · 10회 연속`이 된다. `metricName`은 표·카드·모바일 어디에도 없다. 카테고리 필터에 `메트릭`이 없어서 메트릭 규칙만 모아 볼 수도 없다. 데모는 mock 규칙의 type이 `request`라 `API 요청 · 최근 10분`으로 다르게 틀린다. | `rules-rows.json`, `AlertRulesTab.tsx:32-38`, `:90-97`, `:140-154`, `:405-418`, `AlertsMobileView.tsx:250`, `mockRouter.ts` `billing-queue` | `metric === 'otel_metric'`이면 카테고리 `메트릭`, 조건은 `queue.messages.pending > 100 · 수신 즉시`로 쓴다. 단위는 붙이지 않는다(OTel 단위를 모름). 카테고리 필터에 `메트릭`을 넣는다 | S |
| A-04 | S3 | 규칙 추가 (헬스체크 대상) · 업타임 연계 | 헬스체크 대상 목록에는 Docker 서비스만 있다(`directSignal`이 `null`이라 Direct 목록은 비고, 업타임 모니터는 불러오지 않음). 서버 평가기는 업타임 모니터를 `service_id`로 평가한다. 업타임 상세의 `알림 규칙` 버튼도 그 id로 거른 목록(`대상: uptime_mock_payments`)을 연다. 하지만 거기서 `추가`해도 모니터를 고를 수 없어 `전체 헬스체크` 규칙만 만들 수 있다. 또 TCP 체크는 `StatusCode`를 채우지 않고, 평가기는 0을 999로 바꾼다. 그래서 기본 프리셋 `HTTP 상태 ≥ 400`은 정상인 TCP 모니터에서도 참이 된다. 첫 체크에서 한 번 발송한 뒤 계속 발동 중으로 남아, 실제 다운은 알리지 못한다(소스로 확인). | `uptime-target-options.json`, `target-uptime.png`, `AlertRuleForm.tsx:278-283`, `:419-422`, `UptimeMonitorDetailPage.tsx:272`, `service_evaluator.go:174-186`, `checker/tcp.go:21-52`, `repository_alert_rule.go:241-249` | 헬스체크 대상에 `getUptimeMonitors()`를 `업타임 / 이름`으로 넣고, 목록의 `targetLabel`도 같은 목록을 본다. 평가기는 TCP 대상에 HTTP 상태 대신 체크 성공·실패를 쓴다. 또는 TCP 대상이면 폼에 `응답 시간`만 보인다. §5.2 결정 1의 전제 | M |
| A-05 | S3 | 규칙 탭·발송 이력 (조회 실패) | 규칙 탭은 규칙·채널·Docker 서비스·환경·Direct 서비스·인프라를 `Promise.all` 하나로 받는다. 대상 이름용 요청 하나만 실패해도 규칙이 비고, "구성된 알림 규칙이 없습니다 / 추가"가 뜬다. 같은 화면의 탭 숫자는 `알림 규칙 8`이다. 오류는 영어 원문 토스트 두 개("Demo scenario: telemetry source is temporarily unavailable")로만 알린다. 발송 이력도 실패를 `console.error`로 삼키고 "알림 히스토리가 없습니다"를 띄운다. 상단의 `일부 알림 정보를 불러오지 못했습니다` 배너는 `AlertsPage`의 자체 요청만 본다. 탭 컴포넌트가 따로 보내는 요청은 반영하지 않는다. DESIGN §7("지속 상태는 토스트가 아니다")에 어긋난다. | `scenario-partial-failure-rules.png`·`.json`, `AlertRulesTab.tsx:193-214`, `:370-384`, `NotificationHistoryTab.tsx:112`, `AlertsPage.tsx:240-245` | 규칙 조회와 대상 이름 조회를 나눈다. 이름 조회가 실패하면 규칙은 보이고 대상 칸만 id로 둔다. 규칙·이력 조회 실패는 그 자리의 `다시 시도` 배너(§4.1)로 띄운다 | S |
| A-06 | S3 | 규칙 탭 (모바일) | 모바일 규칙 목록은 이름, `경고 · cpu gt 80`(카드는 `capitalize`로 `Cpu Gt 80`), `활성화됨`, 토글만 보여 준다. 대상·채널·최근 발동이 없다. `수정`·`삭제`가 없어 휴대폰에서는 규칙을 고칠 수 없다. 카드 앞 타일은 metric 앞 세 글자(`lat`, `ote`)를 severity 색으로 칠한다. 데스크톱과 달리 정렬도 하지 않는다. 대상 필터 안내는 이름 대신 id(`직접 서비스 observed_mock_billing`)를 보인다. | `390-light-rules.png`, `390-light-rules-card.png`, `390-light-target.json`, `AlertsMobileView.tsx:78-82`, `:231-258`, `AlertsPage.tsx:274-287` | 데스크톱 표의 `compactTrigger`·`targetLabel`·`ChannelAvatars`를 모듈로 빼서 모바일 카드에서 쓴다. 카드를 누르면 수정 패널을 연다(`FormSidePanel`은 모바일에서 이미 전체 폭). 세 글자 타일은 없앤다 | M |
| A-07 | S2 | 규칙 추가·수정 (검증) | 빈 이름으로 `추가`를 누르면 "필수 항목을 확인해주세요" 토스트만 뜬다. 필드에는 메시지도 `aria-invalid`도 없다(`invalid: []`). 이름 칸은 포커스만 받는다. 메트릭 이름·API 요청 대상이 빠진 경우도 같다. `Field`는 `error`를 받을 수 있고 `ChannelForm`은 그렇게 쓰지만, `AlertRuleForm`은 쓰지 않는다. 토스트는 우측 상단에 떠서 패널의 `닫기` 버튼을 5초 동안 덮는다. DESIGN §7("검증 실패를 토스트로만 알리지 않는다")에 어긋난다. | `1440-light-rule-add-submit-empty.png`·`.json`, `AlertRuleForm.tsx:449-451`, `FormLayout.tsx:41-73` | `formState.errors`를 `Field error`와 `Input invalid`로 연결한다("규칙 이름을 입력하세요", "메트릭 이름을 입력하세요", "서비스를 선택하세요"). 토스트는 첫 오류가 화면 밖일 때만 쓴다 | S |
| A-08 | S2 | 규칙 추가 (프리셋) | `정상` 프리셋은 정상 상태에서 참인 조건을 만든다. 인프라는 `CPU < 70% · 1분`, API 요청은 `에러율 < 1%`, 헬스체크는 `HTTP 상태 ≤ 299`다. 평소 내내 발동하는 규칙이다. 헬스체크·인프라 평가기는 복구 알림을 이미 따로 보낸다(`severity: info`). `직접 설정`이 아니면 연산자·임계값 칸이 감춰진다. 실제 조건은 `lg` 이상에서만 보이는 미리보기에만 나와서, 모바일과 좁은 창에서는 무엇을 저장하는지 알 수 없다. | `1440-light-rule-add-normal-preset.png`, `390-light-rule-add.png`, `AlertRuleForm.tsx:62-73`, `:595-616`, `:805`, `service_evaluator.go:91-108` | `정상` 프리셋을 없앤다. 프리셋은 "권장값 채우기" 버튼으로 바꾸고, 연산자·임계값 칸은 항상 보인다. §3 대안 B | S |
| A-09 | S2 | 규칙 탭 (대상 필터) | 서비스·인프라·업타임 상세의 `알림 규칙`으로 들어오면 `대상: …` 줄이 붙는다. 그런데 거기서 `추가`를 누르면 대상이 빈 폼이 열린다(`handleAddRule`이 target을 넘기지 않음). 대상 필터를 지우는 버튼이 없고, `필터 초기화`도 대상은 지우지 않는다. 결과가 0건이면 그 버튼을 눌러도 아무 일이 없다. 대상 이름을 찾지 못하면 id를 그대로 보여 준다. 대상이 지워졌는지는 알 수 없다(첫 시작 시나리오에서 `shop:api`·`agent_demo_03`). | `target-direct-add.png`, `target-uptime.png`, `scenario-empty-rules.json`, `AlertRulesTab.tsx:259`, `:300-327`, `:40-53` | 대상 줄에 `대상 해제`를 두고, `추가`는 target을 폼 초기값으로 넘긴다(§5.2 결정 2와 같은 통로). 이름을 못 찾으면 `삭제된 대상 (id)`로 쓴다 | S |
| A-10 | S2 | 발송 이력 | 실패 사유가 표에서 한 줄로 잘리고, 펼치거나 툴팁으로 볼 방법이 없다. 모바일 기본 카드와 그리드는 사유를 아예 보이지 않는다. 상태 값은 서버 원문을 `capitalize`한 `Failed`·`Sent`이고, 글자를 상태색으로 칠한다(§5.1 "라벨을 상태색으로 칠하지 않는다"). 이력에 `ruleId`가 있지만 어느 규칙이 보냈는지 열이 없고, 규칙·채널로 이동할 수도 없다. | `history-failed.png`, `390-light-history.png`, `NotificationHistoryTab.tsx:264-287`, `AlertsMobileView.tsx:279-310` | 상태는 `StatusLight`로 `발송`·`실패`·`대기`를 보인다. 사유는 줄바꿈을 허용하거나 행을 펼친다. `규칙` 열(ruleId → 이름)을 두고, 실패 행에 `채널 수정` 링크를 단다. 모바일 카드에도 사유를 보인다 | S~M |
| A-11 | S2 | 발송 이력 (유형 필터) | 유형 선택지는 `리소스·헬스체크·Endpoint·로그·스케줄·시스템`이다. 서버가 실제로 쓰는 `api_request`·`otel_metric`이 없어 API 요청·메트릭 알림만 거를 수 없고, 표에는 `Api_request`·`Otel_metric`으로 나온다. `scheduled`를 만드는 코드는 없다. 규칙 탭의 카테고리(`헬스체크·API 요청·로그·인프라·시스템`)와도 이름이 다르다(`리소스`↔`인프라`, `Endpoint`↔`헬스체크`). | `history-type-options.json`, `NotificationHistoryTab.tsx:11-23`, `:179-186`, `alerter/provider.go:19-25` | 규칙 카테고리 라벨 하나로 맞춘다. 헬스체크 = `endpoint`+`healthcheck`, API 요청 = `api_request`, 메트릭 = `otel_metric`, 인프라 = `resource`, 로그, 시스템이다. `scheduled`는 뺀다 | S |
| A-12 | S2 | 채널 테스트 | 저장된 채널의 `테스트` 결과는 토스트뿐이다("테스트 알림이 전송되었습니다!", 실패는 서버 영어 원문). 테스트는 이력에 남지 않아서, 표의 `최근 발송` 칸은 테스트 뒤에도 "테스트로 확인"이다. 저장 전 `테스트 전송`과 미리보기는 `hidden lg:block` 안에 있어 모바일 채널 페이지와 `lg` 미만 패널에는 없다. 프런트 검증은 `http://`를 받지만 서버는 HTTPS와 도메인 허용 목록(`discord.com`, `hooks.slack.com`)을 요구한다. 어긋난 값은 영어 서버 메시지 토스트로 돌아온다. | `channel-test-toast.png`, `390-light-channel-page.json`(`테스트 전송` 없음), `ChannelForm.tsx:38-44`, `:439`, `AlertsPage.tsx:170-184`, `handlers/notifications.go:113-131`, `alerter/webhook_validator.go` | 테스트 결과를 채널 행에 남긴다("테스트 성공 · 방금", 실패면 사유). 테스트 카드는 미리보기와 떼어 모든 폭에서 폼 아래에 둔다. 프런트 검증을 서버 규칙(HTTPS, 도메인)과 맞추고 필드 인라인 오류로 보인다 | S~M |
| A-13 | S2 | 규칙 목록 (채널 열) | 채널을 고르지 않은 규칙은 꺼진 채널까지 모든 채널 아바타를 보인다. 서버는 이 경우 켜진 채널에만 보낸다. 고른 채널이 모두 꺼져 있으면 서버는 아무 데도 보내지 않고 이력도 남기지 않는데, 목록은 정상 규칙과 똑같이 보인다. | `AlertRulesTab.tsx:598-639`, `alerter/manager.go:86-100`, `:253-268` | 꺼진 채널은 흐리게 두고 툴팁에 `꺼짐`을 붙인다. 실제로 보낼 채널이 0개면 채널 칸에 "보낼 채널 없음"(`text-status-warn`)을 띄운다 | S |
| A-14 | S2 | 탭 (데스크톱) | `AlertRulesTab`이 규칙·채널을 따로 불러온다. 데스크톱에서 규칙을 추가·삭제해도 `AlertsPage`가 가진 목록은 그대로라 탭 숫자 `알림 규칙 8`이 바뀌지 않는다. 같은 목록을 두 번 요청하는 셈이다. | `AlertsPage.tsx:75-85`, `:98-102` ↔ `AlertRulesTab.tsx:193-214`, `:257` | 규칙·채널 상태를 `AlertsPage` 한 곳에 두고 탭에는 `onChanged`를 넘긴다 | S |
| A-15 | S2 | 규칙 추가·수정 (접근성) | 카테고리·지표·프리셋·심각도·채널 버튼 묶음은 선택 상태를 색으로만 보인다. `aria-pressed`도 그룹 이름도 없다(§10.C에 남은 항목). axe 결과는 다음과 같다. `연속 체크 횟수` 입력에 라벨이 없다(`label` critical, 4개 환경). 다크에서 비선택 버튼 글자 `slate-500`이 3.69:1이다(`color-contrast` serious, 3건). 라이트 미리보기의 severity 글자 `text-amber-500`은 1.9:1이다. 규칙 표는 행마다 Tab 정지점이 6개다. 그중 셋(대상 칩, 조건, 채널)은 읽기 전용 툴팁이고, 채널 칸은 접근 이름이 빈 `DIV`다. | `1440-*-rule-add.json`, `390-*-rule-add.json`, `tab-sequence-rules.json`, `AlertRuleForm.tsx:469-481`, `:562-576`, `:601-614`, `:701-705`, `:735-748`, `:760-774` | 버튼에 `aria-pressed`, 묶음에 `role="group"` + `aria-label`을 단다. 비선택 글자는 `text-text-muted`로 바꾼다. 입력에는 `aria-label="연속 체크 횟수"`를 준다. 대상 칩의 툴팁은 잘렸을 때만 붙이고, 채널 칸에는 채널 이름을 접근 이름으로 준다 | S |
| A-16 | S2 | severity 표시 전체 | severity 색이 세 벌이다. `SeverityBadge`는 `bg-red-100 text-red-700 dark:…` 불투명 -100 틴트를 쓴다(§1.5가 "부트스트랩 alert 팔레트"로 걷어낸 형태, §5.1b의 `/10` 알파 틴트와도 다름). 규칙 폼은 선택 버튼 `text-red-600 dark:text-red-400`과 미리보기 `bg-red-500/5`·`text-red-500`을 쓴다. 미리보기에는 `warning` 영어 원문이 나간다. 모바일은 `severityColors`로 또 따로 칠한다. 발송 이력 한 행에서 `Failed`(상태 `#c4282d`)와 `심각`(`red-700`)이 다른 빨강으로 나란히 선다. 축 판단은 표 아래 "severity 축 판단"에 적었다. | `history-failed.png`, `1440-light-rule-add.json`(amber 1.9:1), `SeverityBadge.tsx:13-17`, `AlertRuleForm.tsx:440-444`, `:731-733`, `:866-869`, `AlertsMobileView.tsx:39-43` | `severityLabel.ts`에 `SEVERITY_TONE` 하나를 둔다. critical은 `bg-status-error/10 text-status-error`, warning은 `bg-status-warn/10 text-status-warn`, info는 `bg-sky-500/10 text-sky-700`(다크 값은 §1.5 info와 같게)이다. 점은 `bg-status-*-fill`이다. 세 곳 모두 이것을 쓰고, 미리보기는 `심각`·`경고`·`정보`로 쓴다 | S |
| A-17 | S1 | 규칙 폼·채널 폼·규칙 표 (토큰) | §10.A의 남은 덩어리가 이 메뉴에 몰려 있다. `slate-*`는 전체 상한 64건 중 35건이다(`AlertRuleForm` 18, `ChannelForm` 8, `AlertRulesTab` 6, `channelMeta` 2, `AlertsDesktopView` 1). `dark:`는 29건, `*-dark` 직접 사용은 상한 17건 중 6건이다. 역할 오류는 다섯 가지다. 대상 칸이 분류인데 회색 칩이다(`bg-slate-100 … dark:bg-ui-hover-dark`, §5.3 "칩은 상태 전용"). 채널 테스트 성공·실패가 `emerald`·`red` primitive다(§10.B상 알림 전송 성공·실패는 `status-*` 축). `라이브 미리보기` 앞에 `bg-emerald-400 animate-pulse` 점이 있다(§5.2에서 pulse는 진행 중 장애). 모바일 통계는 `발송` 라벨·값을 `status-healthy`로, `실패 0`도 빨강으로 칠한다. `AlertsDesktopView`의 `bg-slate-300`은 도달하지 않는 분기다. | `AlertRulesTab.tsx:361-367`, `:500`, `:513-517`, `:627`, `:634`, `ChannelForm.tsx:357`, `:526-544`, `AlertRuleForm.tsx:812`, `:823`, `AlertsMobileView.tsx:104-125`, `AlertsDesktopView.tsx:93` | 대상은 맨 텍스트(`text-text-secondary`), 테스트 결과는 `status-*`로 바꾼다. 미리보기 점은 지운다. 모바일 통계 라벨은 중립으로 두고 실패가 0보다 클 때만 칠한다. 바꾼 만큼 `check-design-rules.mjs`의 상한을 내린다 | M |
| A-18 | S1 | 문구·용어 | 탭 이름은 `알림 로그`인데 부제는 "발송 이력"이다. `로그` 메뉴와 이력 유형의 `로그`와도 겹친다. 첫 탭은 `알림 채널`이라, 규칙을 보려고 들어와도 채널이 먼저 열린다. 그 밖에 영어·원시값이 남아 있다. 헬스체크 지표 버튼 `http status`·`response time`(`m.replace('_',' ')`), 목록의 `로그 레벨 1 이상`(숫자), 대상 옵션 접두 `Direct /`, placeholder `e.g. High CPU usage alert`, 미리보기 의사 코드 `IF … FOR … ON … COOLDOWN`과 영어 기본 메시지(`HTTP Status >= 400 detected`), 테스트 토스트의 `!`가 그렇다. | `1440-light-rule-add.png`, `rules-rows.json`, `AlertsDesktopView.tsx:98-102`, `AlertsPage.tsx:17-21`, `AlertRuleForm.tsx:572-574`, `:93-106`, `:516`, `:586`, `:823-858` | 탭은 `알림 규칙`·`발송 이력`·`알림 채널` 순서로 두고 기본을 규칙으로 바꾼다(§3 대안 A). 지표는 `HTTP 상태`·`응답 시간`, 로그 레벨은 `ERROR 이상`처럼 이름으로 쓴다. 미리보기는 한 문장으로 바꾼다(§3 대안 B) | S |
| A-19 | S1 | 시스템 규칙 수정 | 부제와 카드 본문이 같은 문장("시스템이 관리하는 규칙입니다. 메시지와 알림 채널만 수정할 수 있습니다.")을 두 번 보인다. 오른쪽 카드는 `발동 시:` 뒤가 비어 있고, 무엇이 이 규칙을 발동시키는지 어디에도 없다. 채널 선택 버튼에는 `aria-pressed`가 없다(A-15와 같음). | `rule-edit-system.png`, `AlertRuleForm.tsx:163-166`, `:186-191`, `:209-211` | 카드 본문은 지우고, `발동 시:` 자리에 "서버가 시작될 때"(실제 시스템 규칙 `system-boot`)를 쓴다 | S |
| A-20 | S1 | 데모 | 알림 데이터는 시나리오를 따르지 않는다. `첫 시작`에서도 규칙 8·채널 4·이력 32가 그대로이고, 대상만 사라져 id로 보인다. `/notifications/health`는 `startsWith('/notifications')` 분기에 걸려 채널 목록을 돌려준다. 그래서 모든 채널이 "이력 없음 · 규칙 0개 · 테스트로 확인"인데 통계는 29건 발송이다. mock 메트릭 규칙은 type이 `request`이고(A-03), 시스템 규칙 mock(`Service Down`, type `service`)은 실제 시스템 규칙(`Server Boot Notification`, type `system`)과 다르다. Discord·Slack mock 설정은 가려지지 않아 A-01을 재현할 수 없다. | `scenario-empty-*.json`, `1440-light-channels.json`, `mockRouter.ts:60-151`, `:1662`, `mocks/alerts/channels.mock.ts`, `migrations.go:689-711` | 알림 mock을 시나리오에 맞춘다(`empty`면 빈 배열). health 분기를 `/notifications` 분기보다 앞에 둔다. 규칙 mock의 type과 시스템 규칙을 실제와 맞추고, 채널 mock 설정은 서버처럼 `***`로 둔다 | S |

severity 축 판단(A-16): severity(critical·warning·info)는 상태와 **별개 축으로 둔다.** 상태는 대상이 지금 정상인지를 말하고, severity는 규칙을 만든 사람이 정한 중요도다. 같은 장애가 규칙에 따라 `경고`로도 `심각`으로도 갈 수 있다. 그래서 §10.B 표의 "별도 축" 분류와 `SeverityBadge`(표 컬럼의 고정 어휘, §5.1b)는 유지한다. 다만 **색은 §1.5 로그 레벨과 같은 규칙을 따른다.** 2026-11-13에 로그 레벨 error·warn을 상태색으로 옮긴 이유는 "같은 화면에서 서로 다른 빨강이면 뜻이 둘로 읽힌다"였다. 알림 탭은 그 조건이 가장 뚜렷한 화면이다(발송 이력의 실패와 심각이 한 행에 있음). critical·warning은 상태 글자 토큰과 `/10` 틴트, 점은 `-fill`을 쓴다. 상태에 없는 info는 §1.5 info와 같은 sky를 쓴다. 이 결정을 반영할 때 DESIGN.md §10.B 표의 "알림 severity" 칸을 "critical·warning은 `status-*`, info는 primitive"로 고친다. info 토큰은 로그 info와 severity info가 첫 소비처 둘이 되므로 그때 §1.4의 `info` 역할을 만들지 함께 정한다.

확인했지만 문제로 보지 않은 것:

- 시스템 규칙의 삭제는 정상 동작한다. 버튼이 `aria-disabled`라 키보드로 포커스하면 "시스템 규칙은 삭제할 수 없습니다" 툴팁이 뜨고, 눌러도 확인창이 열리지 않는다(`system-rule-delete.json`).
- 채널 삭제 확인 문구("연결된 알림 규칙에서도 제거됩니다")와 `ConfirmDialog` 사용, 7일 요약의 `실패 로그 보기` → 실패 필터 이력, 표 작업 열의 sticky 고정은 문제없다.
- 발송 이력의 날짜 그룹과 페이지 나눔, 채널 표의 7일 발송·실패와 연결 규칙 수도 문제없다. 비교한 네 제품 중 어느 것도 발송 이력 목록을 두지 않는다(§5).
- `ChannelForm`의 필드 인라인 검증(`Field error` + `invalid`), 모바일 채널 페이지 제출 바(하단 내비 위 고정), 채널 미리보기의 서드파티 브랜드 색(§1.7 예외)도 문제없다.
- §3.5 떠 있는 표면 규칙은 지킨다. 사이드 패널은 스크림 위 `bg-bg-surface`이고, `Select` 목록·툴팁·토스트는 `ui-raised`다.
- 채널을 고르지 않으면 모든 활성 채널로 보내는 규칙은 Uptime Kuma의 "기본 사용" 채널과 같은 역할이라 유지한다(채널 열의 표시만 A-13).
- 다크 테마 대비는 규칙 폼 밖에서 axe 위반이 없다.

미확인: 실제 백엔드로 저장·발송한 결과(데모는 mock이라 A-01·A-02·A-04의 서버 쪽은 소스로만 확인), 320px 이하·200% 확대, 실제 스크린리더 낭독, 알림이 많은(수백 개) 규칙 목록의 성능.

## 3. UI 구성 대안

### 대안 A. 탭 순서와 첫 화면: 규칙 먼저

탭을 `알림 규칙`·`발송 이력`·`알림 채널` 순서로 두고 `/alerts`의 기본을 규칙으로 바꾼다. 7일 발송 요약은 `발송 이력` 탭 위로 옮긴다. 채널이 하나도 없을 때만 규칙 탭 위에 "알림을 받을 채널이 없습니다 · 채널 추가" 배너를 둔다. 규칙 폼의 채널 칸에도 `채널 추가` 링크를 둔다.

- **효과:** 메뉴에 들어온 이유(무엇을 감시하는가, 무엇이 발동했는가)가 첫 화면에 온다. 채널은 처음 한 번 설정하면 거의 안 바꾸는 값이다. Grafana(Alert rules가 첫 항목)와 SigNoz(Alert Rules가 첫 탭, Notification Channels는 Configuration 아래)도 같은 순서다.
- **비용:** S. 북마크된 `/alerts?tab=channels`는 그대로 동작한다.

### 대안 B. 규칙 폼: 조건 칸은 항상 보이고, 미리보기는 한 문장으로

지금은 3단계 카드 + 오른쪽 의사 코드 미리보기(`lg` 이상)다. 조건 단계에서 연산자·임계값·평가 방식을 늘 보이고, 프리셋은 그 칸을 채우는 `권장값` 버튼으로 바꾼다. 평가 방식은 카테고리가 정한다(헬스체크는 연속 N회, 인프라는 N분 지속, API 요청은 최근 N분, 로그·메트릭은 수신 즉시). 그 카테고리에서 쓰지 않는 칸은 보이지 않는다. 미리보기는 폼 아래(모든 폭)에 한 문장으로 둔다. 예: "billing-worker의 `queue.messages.pending`이 100을 넘으면 수신 즉시 #backoffice Slack으로 `경고`를 보냅니다."

- **효과:** A-02(무시되는 칸), A-08(숨은 조건), A-18(영어 의사 코드)을 한 번에 다룬다. 모바일에서도 저장할 조건을 읽을 수 있다.
- **비용:** M. 평가 방식 문장은 서버 평가기 다섯 종류(`evaluator.go`, `service_evaluator.go`, `request_evaluator.go`, 로그·메트릭 ingest)와 맞아야 하므로 카테고리별 표를 한 곳에 둔다.

### 대안 C (권장하지 않음). 규칙 상태 열과 발동 중 탭

Grafana·SigNoz처럼 규칙마다 `정상/발동 중` 상태를 보이고 SigNoz의 `Triggered Alerts` 같은 탭을 두는 방안도 검토했다. 그러나 상태가 있는 평가기는 헬스체크·인프라(`wasAlerting`)와 API 요청 창 규칙뿐이다. 로그·API 상태 코드·메트릭 규칙은 이벤트마다 보내고 상태가 없다. 상태 열을 만들면 규칙 절반이 늘 `-`다. 진행 중인 문제는 개요의 장애 목록이 이미 보여 준다. 지금은 `최근 발동` 열을 유지하고 §5.2에서 보류로 둔다.

## 4. 권장 순서

1. **바로 고칠 것 (데이터 손실·잘못된 평가):** A-01, A-02, A-04의 프런트 부분(업타임 대상), A-05.
2. **한 PR로 묶을 S:** A-03, A-07, A-09, A-11, A-13, A-14, A-15, A-16, A-19.
3. **화면 구성:** 대안 A(A-18 포함), 대안 B(A-08 포함), A-06(모바일 규칙), A-10·A-12(발송 실패와 테스트 결과).
4. **결정이 필요한 것:** A-04의 서버 부분(TCP 판정을 평가기에서 고칠지, 폼에서 TCP 대상의 지표를 막을지), A-17(토큰 정리 범위, `ChannelForm` 미리보기 제외), A-20(데모 시나리오).
5. **§5.2에서 추가로 정한 것:** 메트릭 단독 보기에서 알림 규칙 추가(A-09와 같은 통로), 업타임 모니터 대화상자의 `다운되면 알림`(A-04 다음).

## 5. 참고 제품 비교와 추가 결정

### 5.1 비교 대상

2026-11-13에 각 저장소의 기본 브랜치(Uptime Kuma `master`, Checkmate `develop`, Grafana `main`, SigNoz `main`) 소스를 `gh api`로 읽었다. 표의 경로는 그 파일이다. 아래 비교에서 확인하지 못한 항목은 없다.

| 제품 | 알림 설정의 구성 | 주요 소스 |
| --- | --- | --- |
| Uptime Kuma | 모니터 편집 폼 안에 채널 체크박스 목록. 채널 대화상자에 `Default enabled`·`Apply on all existing monitors`·`Test`(결과는 토스트). 발송 이력은 없음(실패는 서버 로그만) | `src/pages/EditMonitor.vue:2236-2268`, `:4080-4084`, `src/components/NotificationDialog.vue:117-130`, `:144`, `:485-489`, `server/model/monitor.js:1558-1569` |
| Checkmate | 모니터 생성 마법사 1단계에 채널 다중 선택. 인프라 모니터는 같은 단계에 CPU·메모리·디스크·온도 임계값 슬라이더. 채널 `Test`(토스트), 발송 이력 없음 | `client/src/Pages/CreateMonitor/index.tsx:947-1037`, `client/src/Pages/Notifications/create/index.tsx:88-93`, `Pages/Notifications/components/NotificationsTable.tsx:56-104` |
| Grafana Alerting | 규칙 목록 행마다 상태(Normal·Pending·Firing·Recovering, nodata·error). contact point마다 마지막 발송 시각·실패 사유. 테스트는 모달 안 인라인 결과. 패널 메뉴 `New alert rule` → `/alerting/new?defaults=<JSON>` | `rule-list/components/AlertRuleListItem.tsx:165-185`, `components/contact-points/ContactPoint.tsx:216-256`, `components/receivers/form/TestContactPointModal.tsx:110-121`, `dashboard-scene/scene/PanelMenuBehavior.tsx:624-646`, `rule-editor/RuleEditor.tsx:136-137` |
| SigNoz | `Alert Rules`(Status·Alert Name·Severity·Labels)·`Triggered Alerts`·`Configuration`(채널·라우팅·계획된 다운타임) 탭. 채널 테스트는 성공 토스트·실패 모달. 탐색기·패널에서 `/alerts/new?compositeQuery=…` | `container/ListAlertRules/table.config.tsx:10-78`, `pages/AlertList/index.tsx:31-93`, `pages/AlertList/NotificationChannels/components/ChannelForm/useChannelFormState.ts:173-195`, `container/ExplorerActions/utils.ts:62-84`, `hooks/queryBuilder/useCreateAlerts.tsx:72-92` |

### 5.2 이전 점검에서 미룬 두 가지

**결정 1. 대상을 추가할 때 알림을 함께 설정하기: 업타임은 축소해 추가, 인프라는 보류.**

- **현재:** 업타임 모니터 추가 대화상자(`UptimeMonitorDialog.tsx`)에는 알림이 없다. 기본 알림 규칙도 없다. 시드되는 규칙은 서버 시작 알림 하나다(`migrations.go:689-711`). 업타임 체크 실패는 장애 기록만 남기고(`checker/recorder.go`), 알림은 헬스체크 규칙이 있을 때만 나간다. 그래서 모니터만 추가한 사용자는 다운돼도 알림을 받지 못한다. 그 모니터만 골라 규칙을 거는 방법도 없다(A-04).
- **업타임: 추가 (S~M, A-04 다음).** Kuma와 Checkmate 모두 모니터 생성 폼에서 채널을 고른다. 업타임 모니터는 "다운되면 알려 달라"가 존재 이유다. 대화상자 아래에 `다운되면 알림` 체크박스 하나를 둔다(활성 채널이 있으면 기본으로 켬). 안내는 "켜진 모든 채널로 보냅니다. 알림 규칙에서 바꿀 수 있습니다"로 한다. 저장하면 그 모니터를 대상으로 하는 헬스체크 규칙을 만든다(기존 `alert_rules` 모델 그대로, 연속 체크 횟수는 장애 기록 기준인 환경설정 `consecutiveFailures`와 같은 값으로 시작). 응답 시간 임계값 같은 세부 조건은 대화상자에 넣지 않고 규칙 폼에 둔다. 새 엔티티나 메뉴를 만들지 않으므로 ADR 0007의 범위 안이다. 전제는 A-04다(규칙 폼이 모니터를 대상으로 고를 수 있고, TCP 다운을 판정할 수 있어야 함).
- **인프라: 보류.** Checkmate는 인프라 모니터 생성 폼에 CPU·메모리·디스크 임계값을 둔다(`CreateMonitor/index.tsx:947-1000`). 하지만 Checkmate는 그 값이 모니터 자체의 필드다. EveryUp의 인프라 추가는 Collector 설치 대화상자이고, 첫 데이터는 설치가 끝난 뒤에 온다. 사용률을 보기 전에 정한 임계값은 추측이다. 대화상자에서 규칙을 조용히 만들면 규칙 목록에 출처 모를 규칙이 생긴다. 인프라 상세의 `알림 규칙`에서 대상이 채워진 폼을 여는 것(결정 2와 같은 통로)으로 충분하다. 인프라 리소스는 있는데 규칙이 하나도 없는 사용자가 실제로 많으면 그때 다시 본다.

**결정 2. 메트릭 단독 보기에서 해당 메트릭으로 알림 규칙 추가: 추가 (S~M).**

- **현재 코드로는 미리 채울 수 없다.** `AlertRuleForm`의 props는 `rule`·`channels`·콜백뿐이고, 새 규칙은 `defaultValues`(헬스체크 · HTTP 상태)로만 시작한다(`AlertRuleForm.tsx:115-121`, `:255-263`). `AlertsPage`는 URL에서 `target`·`serviceId`·`agentId`·`serviceKey`·`resourceId`만 읽고(`alertTarget.ts:9-21`), 그 값은 목록 필터에만 쓴다. `추가`는 `rulesAddTrigger` 숫자만 올려 빈 폼을 연다(`AlertsPage.tsx:216-218`, `AlertRulesTab.tsx:220-222`, `:259`). 메트릭 이름을 받는 URL 파라미터는 없다. 같은 이유로 대상 필터가 걸린 목록에서 `추가`해도 대상이 비어 있다(A-09).
- **근거:** 메트릭 임계값 알림(`alert_rules.metric_name`)은 이미 있고, 수신 시점의 원값으로 평가한다. 그래서 조회 엔진(메트릭 계획 3단계)을 기다릴 필요가 없다. Grafana(`?defaults=`)와 SigNoz(`?compositeQuery=`)가 같은 방식으로 탐색 화면에서 규칙 폼을 채워 연다. 규칙을 만들면 그 차트에 임계선이 바로 그려진다(`useAlertThresholds`가 `metricName`으로 거름).
- **구현 범위:**
  1. `alertTarget.ts`에 `alertRuleNewPath(target, { category, metricName })`를 둔다. 결과는 `/alerts?tab=rules&target=direct&serviceId=…&new=metric&metricName=…`이다.
  2. `AlertsPage`가 `new`를 읽어 규칙 탭에 초기값을 넘기고, 폼을 연 뒤 `new`·`metricName`을 URL에서 지운다(새로고침 시 다시 열리지 않게).
  3. `AlertRuleForm`에 `initial?: Partial<RuleFormValues>`를 받아 `defaultValues`에 합친다. 대상 필터 목록의 `추가`도 같은 `initial`로 대상을 넘긴다.
  4. 메트릭 단독 보기의 제목 줄에 `알림 추가`(`ButtonLink`)를 둔다. 임계값은 비워 두고 필수로 받는다(A-02).
  5. Direct 서비스의 메트릭 이름 제안을 연결한다(`getObservedServiceOtelMetricNames`, A-02).

### 5.3 그 밖의 기능 비교와 결정

EveryUp 상태: 있음 / 일부 / 없음. 기본 결정은 ADR 0007("메뉴=직접 설정 대상만")에 따라 범위를 넓히지 않는 `보류`다.

| 기능 | 갖춘 제품 (근거) | EveryUp | 결정 | 규모 | 이유 |
| --- | --- | --- | :-: | :-: | --- |
| 발송 이력 목록(건별 성공·실패·사유) | 없음. 네 제품 모두 없음 (Kuma `monitor.js:1558-1569`, Checkmate `notificationRoutes.ts`) | 있음 `NotificationHistoryTab` | 유지 | - | 비교 대상에 없는 장점이다. 읽기 어려운 점만 A-10에서 고친다 |
| 채널별 발송 상태 | Grafana `ContactPoint.tsx:216-256`(마지막 시도·실패 사유) | 일부: 7일 발송·실패 수, 최근 발송 시각. 마지막 실패 사유는 없음 | **추가** | S | 채널 행에 마지막 실패 사유를 붙인다. A-12의 테스트 결과와 같은 자리다 |
| 채널 테스트 | 네 제품 모두. Grafana만 모달 안 인라인, 나머지는 토스트 | 있음: 저장 전·저장 후 둘 다 | 유지 | - | 결과 표시는 A-12 |
| 기본 채널 / 모든 모니터에 적용 | Kuma `isDefault`·`applyExisting` | 있음: 채널을 고르지 않은 규칙은 모든 활성 채널 | 유지 | - | 같은 역할이다. 표시만 A-13 |
| 대상 생성 시 알림 | Kuma `EditMonitor.vue:2236`, Checkmate `CreateMonitor/index.tsx:1027-1037` | 없음 | **업타임 추가 / 인프라 보류** | S~M | §5.2 결정 1 |
| 탐색 화면에서 규칙 만들기(값 채움) | Grafana `PanelMenuBehavior.tsx:624-646`, SigNoz `CreateAlertButton.tsx` | 없음: 상세의 `알림 규칙`은 필터된 목록만 | **추가** | S~M | §5.2 결정 2 |
| 규칙 상태(정상·발동 중·오류) | Grafana `StateIcon.tsx:34-115`, SigNoz `table.config.tsx:10-15` | 일부: `최근 발동`만 | 보류 | M | 상태가 있는 평가기는 헬스체크·인프라·API 요청 창 규칙뿐이다(§3 대안 C). 개요의 장애 목록과 겹치는지 먼저 본다 |
| 발동 중 알림 탭 | SigNoz `Triggered Alerts` (`pages/AlertList/index.tsx:86-93`) | 없음 | 제외 | M | 개요의 장애 목록과 발송 이력이 나눠 맡는다. 상태 없는 규칙이 절반이라 탭이 비어 보인다 |
| 다운 중 반복 발송 | Kuma `resendInterval` (`EditMonitor.vue:1700-1709`) | 없음: 헬스체크·인프라는 상태가 바뀔 때만 보냄 | 보류 | S | 결정 1의 업타임 알림이 쓰이는 모습을 본 뒤 정한다 |
| 재시도·연속 실패 기준 | Kuma `maxretries`, Checkmate `statusWindowSize`·`statusWindowThreshold` | 있음: 규칙의 `연속 체크 횟수`, 환경설정 `consecutiveFailures` | 유지 | - | |
| 인증서 만료 알림 | Kuma `EditMonitor.vue:1732`, 일수는 `settings/Notifications.vue:58-90` | 일부: 만료일은 수집(`runner.go` `SetCertExpiry`), 알림 지표는 없음(`models/alert_rule.go`의 `AlertMetric`에 없음) | 보류 | M | 업타임 메뉴의 다음 점검 대상이다. 알림 메뉴에서 먼저 열 일은 아니다 |
| 라우팅 정책·레이블 | Grafana notification policies, SigNoz Routing Policies | 없음 | 제외 | L | 한 팀이 쓰는 셀프호스팅 도구에는 규칙별 채널 선택으로 충분하다 |
| 사용자 정의 테스트 알림 | Grafana `TestContactPointModal`(annotation·label 입력) | 없음: 고정 테스트 메시지 | 제외 | S | 채널 연결 확인이 목적이라 고정 메시지로 충분하다 |
| 계획된 다운타임(알림 무음) | SigNoz `Planned Downtime` | 없음 | 보류 | M | 업타임·인프라 점검 때 실제 필요를 확인한다. 지금은 규칙 토글로 대신한다 |

요약: **추가 3건**(업타임 생성 시 다운 알림, 탐색 화면에서 규칙 만들기, 채널 행의 마지막 실패 사유), **보류 5건**(인프라 생성 시 임계값, 규칙 상태, 반복 발송, 인증서 만료 알림, 계획된 다운타임), **제외 3건**(발동 중 탭, 라우팅 정책, 사용자 정의 테스트 알림). 네 제품 모두 건별 발송 이력을 두지 않았다. EveryUp의 발송 이력과 채널별 7일 집계는 따라갈 대상이 아니라 유지할 차별점이다.
