FROM golang:1.25-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
COPY cmd ./cmd
COPY internal ./internal

RUN CGO_ENABLED=0 GOOS=linux go build -o /out/everyup-agent ./cmd/everyup-agent

# App-instrumentation bundle: Node auto-instrumentation + EveryUp register.js.
# Copied into a shared volume at agent startup so app containers can load it
# via NODE_OPTIONS without installing anything.
FROM node:24-alpine AS instrumentation-node
WORKDIR /bundle
COPY instrumentation/node/package.json instrumentation/node/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY instrumentation/node/register.js ./

# OTel Java agent: JAVA_TOOL_OPTIONS=-javaagent:... needs only this jar.
FROM alpine:3.21 AS instrumentation-java
ARG OTEL_JAVAAGENT_VERSION=2.28.1
RUN wget -q -O /opentelemetry-javaagent.jar \
    "https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_JAVAAGENT_VERSION}/opentelemetry-javaagent.jar"

FROM alpine:3.21

RUN adduser -D -H everyup \
    && mkdir -p /data /etc/everyup/generated /everyup-instrumentation \
    && chown -R everyup:everyup /data /etc/everyup /everyup-instrumentation

COPY --from=build /out/everyup-agent /usr/local/bin/everyup-agent
COPY --from=instrumentation-node /bundle /opt/everyup/instrumentation/node
COPY --from=instrumentation-java /opentelemetry-javaagent.jar /opt/everyup/instrumentation/java/opentelemetry-javaagent.jar

USER everyup

EXPOSE 4318

ENTRYPOINT ["everyup-agent"]
