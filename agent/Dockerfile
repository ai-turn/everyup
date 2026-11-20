FROM --platform=$BUILDPLATFORM golang:1.27-alpine3.23@sha256:f70850ef6ce341e8b6427f677049145d63c0b7ce002d4d7e3d464828b1b96dcd AS build

ARG TARGETOS=linux
ARG TARGETARCH

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -ldflags="-w -s" -o /out/everyup-agent ./cmd/everyup-agent

# App-instrumentation bundle: Node auto-instrumentation + EveryUp register.js.
# Copied into a shared volume at agent startup so app containers can load it
# via NODE_OPTIONS without installing anything.
FROM --platform=$BUILDPLATFORM node:24-alpine3.23@sha256:3946fb783fdce8a2812136ea694bc95c698c4f4096f3fd18568dc27a8ac389dc AS instrumentation-node
WORKDIR /bundle
COPY instrumentation/node/package.json instrumentation/node/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY instrumentation/node/register.js ./

# OTel Java agent: JAVA_TOOL_OPTIONS=-javaagent:... needs only this jar.
FROM --platform=$BUILDPLATFORM alpine:3.24@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS instrumentation-java
ARG OTEL_JAVAAGENT_VERSION=2.28.1
ARG OTEL_JAVAAGENT_SHA256=faa89bdeebf9b1f52be4a4374689176717b02a59df2d8f8b6eb9aa39f9292589
RUN wget -q -O /opentelemetry-javaagent.jar \
    "https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_JAVAAGENT_VERSION}/opentelemetry-javaagent.jar" \
    && echo "${OTEL_JAVAAGENT_SHA256}  /opentelemetry-javaagent.jar" | sha256sum -c -

FROM alpine:3.24@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf

RUN adduser -D -H everyup \
    && mkdir -p /data /etc/everyup/generated /everyup-instrumentation \
    && chown -R everyup:everyup /data /etc/everyup /everyup-instrumentation

COPY --from=build /out/everyup-agent /usr/local/bin/everyup-agent
COPY --from=instrumentation-node /bundle /opt/everyup/instrumentation/node
COPY --from=instrumentation-java /opentelemetry-javaagent.jar /opt/everyup/instrumentation/java/opentelemetry-javaagent.jar

USER everyup

EXPOSE 4318

ENTRYPOINT ["everyup-agent"]
