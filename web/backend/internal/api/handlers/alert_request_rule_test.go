package handlers_test

import "testing"

// Windowed request metrics only exist on the request rule type, and a request
// rule must name a target.
func TestAlertRuleCreate_RequestRuleValidation(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	cases := []struct {
		name string
		body map[string]interface{}
		want int
	}{
		{"request rule with agent target", map[string]interface{}{"name": "p99", "type": "request", "metric": "latency_p99", "agentId": "agent-1", "threshold": 800, "duration": 5}, 201},
		{"request rule without target", map[string]interface{}{"name": "err", "type": "request", "metric": "error_rate", "threshold": 5}, 400},
		{"windowed metric on service type", map[string]interface{}{"name": "err", "type": "service", "metric": "error_rate", "agentId": "agent-1", "threshold": 5}, 400},
		{"request type with a per-event metric", map[string]interface{}{"name": "cpu", "type": "request", "metric": "cpu", "agentId": "agent-1", "threshold": 5}, 400},
	}
	for _, tc := range cases {
		resp, result := ts.doRequest(t, "POST", "/api/v1/alert-rules", tc.body, auth...)
		if resp.StatusCode != tc.want {
			t.Errorf("%s: status = %d (%v), want %d", tc.name, resp.StatusCode, result.Error, tc.want)
		}
	}
}
