package checker

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLeafCertExpiry(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	tlsSrv := httptest.NewTLSServer(handler)
	defer tlsSrv.Close()
	resp, err := tlsSrv.Client().Get(tlsSrv.URL)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	got := leafCertExpiry(resp)
	if got == nil || !got.Equal(tlsSrv.Certificate().NotAfter) {
		t.Fatalf("HTTPS: got %v, want %v", got, tlsSrv.Certificate().NotAfter)
	}

	plainSrv := httptest.NewServer(handler)
	defer plainSrv.Close()
	resp, err = http.Get(plainSrv.URL)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if got := leafCertExpiry(resp); got != nil {
		t.Fatalf("plain HTTP should have no certificate, got %v", got)
	}
}
