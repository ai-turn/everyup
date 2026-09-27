package telemetrygateway

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

type recordingForwarder struct {
	signal string
	body   []byte
}

func (f *recordingForwarder) ForwardOTLPProtobuf(_ context.Context, signal string, data []byte) ([]byte, error) {
	f.signal = signal
	f.body = append([]byte(nil), data...)
	return []byte{9, 8, 7}, nil
}

type recordingObserver struct {
	traced []string
}

func (o *recordingObserver) MarkTraced(service string) {
	o.traced = append(o.traced, service)
}

func TestServerForwardsTraces(t *testing.T) {
	forwarder := &recordingForwarder{}
	server := New(":0", forwarder, nil, nil, nil)
	handler := server.handleOTLP("traces")

	req := httptest.NewRequest(http.MethodPost, "/v1/traces", bytes.NewReader([]byte{1, 2, 3}))
	req.Header.Set("Content-Type", "application/x-protobuf")
	resp := httptest.NewRecorder()

	handler(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", resp.Code, resp.Body.String())
	}
	if forwarder.signal != "traces" || !bytes.Equal(forwarder.body, []byte{1, 2, 3}) || !bytes.Equal(resp.Body.Bytes(), []byte{9, 8, 7}) {
		t.Fatalf("forwarded signal=%q body=%v", forwarder.signal, forwarder.body)
	}
}

func TestServerAttributesEBPFTracesAndMarksTraced(t *testing.T) {
	forwarder := &recordingForwarder{}
	observer := &recordingObserver{}
	server := New(":0", forwarder, fakeIPResolver{"192.0.2.1": "everyup-ebpf"}, fakePIDResolver{42: "checkout-api"}, observer)
	handler := server.handleOTLP("traces")

	body := marshalTraces(t, ebpfResource("whoami", "host:42", "whoami"))
	req := httptest.NewRequest(http.MethodPost, "/v1/traces", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/x-protobuf")
	resp := httptest.NewRecorder()

	handler(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", resp.Code, resp.Body.String())
	}
	forwarded := unmarshalTraces(t, forwarder.body)
	if got := serviceNameOf(forwarded.GetResourceSpans()[0]); got != "checkout-api" {
		t.Fatalf("forwarded service.name = %q, want checkout-api", got)
	}
	if len(observer.traced) != 1 || observer.traced[0] != "checkout-api" {
		t.Fatalf("observer.traced = %v, want [checkout-api]", observer.traced)
	}
}

func TestServerAcksFullyDroppedEBPFTraces(t *testing.T) {
	forwarder := &recordingForwarder{}
	observer := &recordingObserver{}
	server := New(":0", forwarder, fakeIPResolver{"192.0.2.1": "everyup-ebpf"}, fakePIDResolver{}, observer)
	handler := server.handleOTLP("traces")

	body := marshalTraces(t, ebpfResource("docker-proxy", "host:1", "gateway"))
	req := httptest.NewRequest(http.MethodPost, "/v1/traces", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/x-protobuf")
	resp := httptest.NewRecorder()

	handler(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 ack", resp.Code)
	}
	if forwarder.signal != "" || forwarder.body != nil {
		t.Fatalf("nothing should be forwarded, got signal=%q", forwarder.signal)
	}
	if len(observer.traced) != 0 {
		t.Fatalf("observer.traced = %v, want none", observer.traced)
	}
}

func TestServerRejectsNonProtobuf(t *testing.T) {
	forwarder := &recordingForwarder{}
	server := New(":0", forwarder, nil, nil, nil)
	handler := server.handleOTLP("logs")

	req := httptest.NewRequest(http.MethodPost, "/v1/logs", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	handler(resp, req)

	if resp.Code != http.StatusUnsupportedMediaType {
		t.Fatalf("status = %d, want %d", resp.Code, http.StatusUnsupportedMediaType)
	}
}

func TestServerRejectsUndiscoveredSource(t *testing.T) {
	forwarder := &recordingForwarder{}
	server := New(":0", forwarder, fakeIPResolver{"192.0.2.2": "checkout"}, nil, nil)
	req := httptest.NewRequest(http.MethodPost, "/v1/traces", bytes.NewReader(marshalTraces(t, appResource("billing"))))
	req.Header.Set("Content-Type", "application/x-protobuf")
	resp := httptest.NewRecorder()
	server.handleOTLP("traces")(resp, req)
	if resp.Code != http.StatusForbidden || forwarder.signal != "" {
		t.Fatalf("status=%d forwarded=%q, want rejection", resp.Code, forwarder.signal)
	}
}

func TestServerBindsExplicitServiceToSourceContainer(t *testing.T) {
	forwarder := &recordingForwarder{}
	server := New(":0", forwarder, fakeIPResolver{"192.0.2.1": "checkout"}, nil, nil)
	resource := appResource("billing")
	resource.Resource.Attributes = append(resource.Resource.Attributes, kv("service.name", "another-service"))
	req := httptest.NewRequest(http.MethodPost, "/v1/traces", bytes.NewReader(marshalTraces(t, resource)))
	req.Header.Set("Content-Type", "application/x-protobuf")
	resp := httptest.NewRecorder()
	server.handleOTLP("traces")(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("status=%d, want 200", resp.Code)
	}
	for _, attr := range unmarshalTraces(t, forwarder.body).GetResourceSpans()[0].GetResource().GetAttributes() {
		if attr.GetKey() == "service.name" && attr.GetValue().GetStringValue() != "checkout" {
			t.Fatalf("service.name=%q, want checkout", attr.GetValue().GetStringValue())
		}
	}
}

func TestServerRejectsForgedEBPFSource(t *testing.T) {
	forwarder := &recordingForwarder{}
	server := New(":0", forwarder, fakeIPResolver{"192.0.2.1": "checkout"}, fakePIDResolver{42: "billing"}, nil)
	req := httptest.NewRequest(http.MethodPost, "/v1/traces", bytes.NewReader(marshalTraces(t, ebpfResource("billing", "host:42", "billing"))))
	req.Header.Set("Content-Type", "application/x-protobuf")
	resp := httptest.NewRecorder()
	server.handleOTLP("traces")(resp, req)
	if resp.Code != http.StatusForbidden || forwarder.signal != "" {
		t.Fatalf("status=%d forwarded=%q, want rejection", resp.Code, forwarder.signal)
	}
}
