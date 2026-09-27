package telemetrygateway

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestServiceTokenBindsGatewayIdentity(t *testing.T) {
	token, err := MintServiceToken("long-agent-secret", "checkout")
	if err != nil {
		t.Fatal(err)
	}
	forwarder := &recordingForwarder{}
	server := New(":0", forwarder, nil, nil, nil)
	server.RequireServiceTokens("long-agent-secret")
	body := marshalTraces(t, appResource("billing"))
	send := func(auth string) int {
		req := httptest.NewRequest(http.MethodPost, "/v1/traces", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/x-protobuf")
		if auth != "" {
			req.Header.Set("Authorization", "Bearer "+auth)
		}
		resp := httptest.NewRecorder()
		server.handleOTLP("traces")(resp, req)
		return resp.Code
	}
	if status := send(""); status != http.StatusUnauthorized {
		t.Fatalf("missing token status = %d", status)
	}
	if status := send(strings.Replace(token, "checkout", "billing", 1) + "x"); status != http.StatusForbidden {
		t.Fatalf("forged token status = %d", status)
	}
	if forwarder.body != nil {
		t.Fatal("unauthorized payload was forwarded")
	}
	if status := send(token); status != http.StatusOK {
		t.Fatalf("valid token status = %d", status)
	}
	if got := serviceNameOf(unmarshalTraces(t, forwarder.body).GetResourceSpans()[0]); got != "checkout" {
		t.Fatalf("forwarded service.name = %q, want checkout", got)
	}
}

func TestServiceTokenRejectsChangedService(t *testing.T) {
	token, err := MintServiceToken("secret", "checkout")
	if err != nil {
		t.Fatal(err)
	}
	other, err := MintServiceToken("secret", "billing")
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(token, ".")
	otherParts := strings.Split(other, ".")
	forged := parts[0] + "." + otherParts[1] + "." + parts[2]
	if service, ok := serviceFromToken("secret", forged); ok {
		t.Fatalf("forged token accepted for %q", service)
	}
	if service, ok := serviceFromToken("secret", token); !ok || service != "checkout" {
		t.Fatalf("valid token resolved to %q, ok=%t", service, ok)
	}
}

func TestServiceTokenCannotClaimEBPFSource(t *testing.T) {
	token, err := MintServiceToken("secret", "checkout")
	if err != nil {
		t.Fatal(err)
	}
	forwarder := &recordingForwarder{}
	server := New(":0", forwarder, nil, nil, nil)
	server.RequireServiceTokens("secret")
	req := httptest.NewRequest(http.MethodPost, "/v1/traces", bytes.NewReader(marshalTraces(t, ebpfResource("checkout", "host:42", "checkout"))))
	req.Header.Set("Content-Type", "application/x-protobuf")
	req.Header.Set("Authorization", "Bearer "+token)
	resp := httptest.NewRecorder()
	server.handleOTLP("traces")(resp, req)
	if resp.Code != http.StatusForbidden || forwarder.body != nil {
		t.Fatalf("status = %d, forwarded = %v; want rejected eBPF claim", resp.Code, forwarder.body)
	}
}
