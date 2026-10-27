package checker

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"time"

	"github.com/aiturn/everyup/internal/models"
)

// HTTPChecker performs HTTP health checks
type HTTPChecker struct {
	client *http.Client
}

// NewHTTPChecker creates a new HTTP checker with SSRF protection.
// The transport uses a safe dialer that blocks connections to private/internal IP addresses.
func NewHTTPChecker() *HTTPChecker {
	return &HTTPChecker{
		client: &http.Client{
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{
					InsecureSkipVerify: true, // Allow self-signed certs
				},
				DisableKeepAlives: true,
				DialContext:       safeDialContext(),
			},
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 10 {
					return fmt.Errorf("too many redirects")
				}
				return nil
			},
		},
	}
}

// Check performs an HTTP health check
func (c *HTTPChecker) Check(config *models.HTTPConfig) *CheckResult {
	result := &CheckResult{
		CheckedAt: time.Now(),
	}

	// Set timeout
	c.client.Timeout = time.Duration(config.Timeout) * time.Millisecond

	// Create request
	req, err := http.NewRequest(config.Method, config.URL, nil)
	if err != nil {
		result.Status = models.CheckStatusFailure
		result.ErrorMessage = fmt.Sprintf("Failed to create request: %v", err)
		return result
	}

	// Add headers
	for key, value := range config.Headers {
		req.Header.Set(key, value)
	}

	// Set default User-Agent
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", "EveryUp/1.0")
	}

	// Perform request
	startTime := time.Now()
	resp, err := c.client.Do(req)
	result.ResponseTime = int(time.Since(startTime).Milliseconds())

	if err != nil {
		result.Status = models.CheckStatusFailure
		result.ErrorMessage = fmt.Sprintf("Request failed: %v", err)
		return result
	}
	defer resp.Body.Close()

	result.StatusCode = resp.StatusCode
	result.CertExpiresAt = leafCertExpiry(resp)

	// Check expected status
	if config.ExpectedStatus > 0 && resp.StatusCode != config.ExpectedStatus {
		result.Status = models.CheckStatusFailure
		result.ErrorMessage = fmt.Sprintf("Expected status %d, got %d", config.ExpectedStatus, resp.StatusCode)
		return result
	}

	// Default: 2xx is success
	if config.ExpectedStatus == 0 && (resp.StatusCode < 200 || resp.StatusCode >= 300) {
		result.Status = models.CheckStatusFailure
		result.ErrorMessage = fmt.Sprintf("Non-2xx status: %d", resp.StatusCode)
		return result
	}

	result.Status = models.CheckStatusSuccess
	return result
}

// CheckResult represents the result of a health check
type CheckResult struct {
	Status       models.CheckStatus
	ResponseTime int // milliseconds
	StatusCode   int // HTTP status code
	ErrorMessage string
	CheckedAt    time.Time
	// CertExpiresAt is the served leaf certificate's NotAfter; nil for plain HTTP.
	CertExpiresAt *time.Time
}

// leafCertExpiry reads the certificate of the final (post-redirect) response.
// Verification is skipped for self-signed certs, but the chain is still recorded.
func leafCertExpiry(resp *http.Response) *time.Time {
	if resp.TLS == nil || len(resp.TLS.PeerCertificates) == 0 {
		return nil
	}
	t := resp.TLS.PeerCertificates[0].NotAfter
	return &t
}

// ToMetric converts CheckResult to Metric model
func (r *CheckResult) ToMetric(serviceID string) *models.Metric {
	return &models.Metric{
		ServiceID:    serviceID,
		Status:       r.Status,
		ResponseTime: r.ResponseTime,
		StatusCode:   r.StatusCode,
		ErrorMessage: r.ErrorMessage,
		CheckedAt:    r.CheckedAt,
	}
}
