package telemetrygateway

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strings"
	"unicode/utf8"
)

const tokenPrefix = "evup_otlp_v1."

// MintServiceToken creates a credential scoped to one OTLP service identity.
// The secret stays in the agent; the application receives only this token.
func MintServiceToken(secret, service string) (string, error) {
	service = strings.TrimSpace(service)
	if secret == "" || !validServiceName(service) {
		return "", errors.New("an agent key and a service name (up to 255 bytes) are required")
	}
	encoded := base64.RawURLEncoding.EncodeToString([]byte(service))
	mac := tokenMAC(secret, service)
	return tokenPrefix + encoded + "." + base64.RawURLEncoding.EncodeToString(mac), nil
}

func serviceFromToken(secret, token string) (string, bool) {
	if secret == "" || !strings.HasPrefix(token, tokenPrefix) {
		return "", false
	}
	parts := strings.Split(strings.TrimPrefix(token, tokenPrefix), ".")
	if len(parts) != 2 {
		return "", false
	}
	decoded, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil || !validServiceName(string(decoded)) {
		return "", false
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || !hmac.Equal(signature, tokenMAC(secret, string(decoded))) {
		return "", false
	}
	return string(decoded), true
}

func tokenMAC(secret, service string) []byte {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte("everyup:otlp:service:v1:" + service))
	return mac.Sum(nil)
}

func validServiceName(name string) bool {
	if name == "" || len(name) > 255 || !utf8.ValidString(name) || strings.TrimSpace(name) != name {
		return false
	}
	for _, r := range name {
		if r < 0x20 || r == 0x7f {
			return false
		}
	}
	return true
}
