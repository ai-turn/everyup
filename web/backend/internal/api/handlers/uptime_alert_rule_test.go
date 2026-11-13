package handlers_test

import (
	"encoding/json"
	"testing"
)

// Health-check rules can target one uptime monitor. The monitor lives in the
// services table, not in observed services, so the direct-signal check must
// not reject it.
func TestAlertRuleCreate_UptimeMonitorTarget(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	monitorID := createTCPMonitor(t, ts, auth, nil)

	rule := func(serviceID, metric string) map[string]interface{} {
		return map[string]interface{}{"name": "down", "type": "service", "metric": metric, "operator": "gte",
			"threshold": 400, "duration": 1, "severity": "critical", "serviceId": serviceID}
	}
	cases := []struct {
		name string
		body map[string]interface{}
		want int
	}{
		{"http status on an uptime monitor", rule(monitorID, "http_status"), 201},
		{"response time on an uptime monitor", rule(monitorID, "response_time"), 201},
		{"health metric on an unknown id", rule("missing-monitor", "http_status"), 400},
	}
	for _, tc := range cases {
		resp, result := ts.doRequest(t, "POST", "/api/v1/alert-rules", tc.body, auth...)
		if resp.StatusCode != tc.want {
			t.Errorf("%s: status = %d (%v), want %d", tc.name, resp.StatusCode, result.Error, tc.want)
		}
	}
}

// Adding a monitor with alertOnDown creates one health-check rule for that
// monitor; without it no rule appears.
func TestUptimeMonitorCreate_AlertOnDown(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	withAlert := createTCPMonitor(t, ts, auth, map[string]interface{}{"name": "db", "alertOnDown": true})
	createTCPMonitor(t, ts, auth, map[string]interface{}{"name": "cache"})

	_, result := ts.doRequest(t, "GET", "/api/v1/alert-rules", nil, auth...)
	if !result.Success {
		t.Fatalf("list rules: %v", result.Error)
	}
	var rules []struct {
		Name       string   `json:"name"`
		Type       string   `json:"type"`
		Metric     string   `json:"metric"`
		Operator   string   `json:"operator"`
		Threshold  float64  `json:"threshold"`
		Duration   int      `json:"duration"`
		Severity   string   `json:"severity"`
		IsEnabled  bool     `json:"isEnabled"`
		ServiceID  *string  `json:"serviceId"`
		ChannelIDs []string `json:"channelIds"`
	}
	if err := json.Unmarshal(result.Data, &rules); err != nil {
		t.Fatal(err)
	}
	var found int
	for _, r := range rules {
		if r.ServiceID == nil {
			continue
		}
		found++
		if *r.ServiceID != withAlert {
			t.Errorf("rule for unexpected monitor %s", *r.ServiceID)
		}
		if r.Name != "db 다운" || r.Type != "service" || r.Metric != "http_status" || r.Operator != "gte" ||
			r.Threshold != 400 || r.Duration != 3 || r.Severity != "critical" || !r.IsEnabled || len(r.ChannelIDs) != 0 {
			t.Errorf("unexpected down rule: %+v", r)
		}
	}
	if found != 1 {
		t.Fatalf("monitor rules = %d, want 1", found)
	}
}

func createTCPMonitor(t *testing.T, ts *testServer, auth []string, extra map[string]interface{}) string {
	t.Helper()
	body := map[string]interface{}{"name": "public-tcp", "type": "tcp", "host": "1.1.1.1", "port": 1, "timeout": 50, "interval": 3600}
	for k, v := range extra {
		body[k] = v
	}
	_, result := ts.doRequest(t, "POST", "/api/v1/services", body, auth...)
	if !result.Success {
		t.Fatalf("create monitor: %v", result.Error)
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(result.Data, &created); err != nil {
		t.Fatal(err)
	}
	return created.ID
}

// Deleting a monitor deletes the rules that target only that monitor, so the
// rule list never shows "삭제된 대상". Global rules and other monitors' rules stay.
func TestUptimeMonitorDelete_RemovesItsRules(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))
	gone := createTCPMonitor(t, ts, auth, map[string]interface{}{"name": "db", "alertOnDown": true})
	kept := createTCPMonitor(t, ts, auth, map[string]interface{}{"name": "cache", "alertOnDown": true})
	ts.doRequest(t, "POST", "/api/v1/alert-rules", map[string]interface{}{"name": "all down", "type": "service",
		"metric": "http_status", "operator": "gte", "threshold": 400, "duration": 1, "severity": "warning"}, auth...)

	resp, _ := ts.doRequest(t, "DELETE", "/api/v1/services/"+gone, nil, auth...)
	if resp.StatusCode != 204 {
		t.Fatalf("delete monitor: status %d", resp.StatusCode)
	}

	_, result := ts.doRequest(t, "GET", "/api/v1/alert-rules", nil, auth...)
	var rules []struct {
		Name      string  `json:"name"`
		ServiceID *string `json:"serviceId"`
	}
	json.Unmarshal(result.Data, &rules)
	names := map[string]bool{}
	for _, r := range rules {
		if r.ServiceID != nil && *r.ServiceID == gone {
			t.Errorf("rule %q still targets the deleted monitor", r.Name)
		}
		names[r.Name] = true
	}
	if !names["cache 다운"] || !names["all down"] {
		t.Fatalf("unrelated rules were deleted: %v (kept monitor %s)", names, kept)
	}
}
