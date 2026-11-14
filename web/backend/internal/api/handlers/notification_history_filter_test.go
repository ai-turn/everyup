package handlers_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// The history type filter takes a comma list, so one UI category can cover
// several stored alert types (헬스체크 = endpoint + healthcheck).
func TestNotificationHistory_AlertTypeList(t *testing.T) {
	ts := setupTestServer(t)
	auth := authHeader(ts.setupAdmin(t, "admin", "testpass123"))

	if err := database.NewNotificationRepository().Create(&models.NotificationChannel{
		ID: "c1", Name: "ops", Type: "slack", Config: `{"webhookUrl":"https://hooks.slack.com/services/x"}`, IsEnabled: true, CreatedAt: time.Now(),
	}); err != nil {
		t.Fatalf("channel: %v", err)
	}
	repo := database.NewNotificationHistoryRepository()
	for _, alertType := range []string{"endpoint", "healthcheck", "otel_metric", "log"} {
		if err := repo.Create(&models.NotificationHistory{
			ChannelID: "c1", ChannelName: "ops", ChannelType: "slack", AlertType: alertType,
			Message: alertType, Status: "sent", CreatedAt: time.Now(),
		}); err != nil {
			t.Fatalf("seed %s: %v", alertType, err)
		}
	}

	for _, tc := range []struct {
		query string
		want  int
	}{
		{"endpoint,healthcheck", 2},
		{"otel_metric", 1},
		{"", 4},
	} {
		path := "/api/v1/notification-history"
		if tc.query != "" {
			path += "?alert_type=" + tc.query
		}
		_, result := ts.doRequest(t, "GET", path, nil, auth...)
		if !result.Success {
			t.Fatalf("%s: %v", tc.query, result.Error)
		}
		var page struct {
			Items []struct {
				AlertType string `json:"alertType"`
			} `json:"items"`
			Total int `json:"total"`
		}
		if err := json.Unmarshal(result.Data, &page); err != nil {
			t.Fatal(err)
		}
		if len(page.Items) != tc.want || page.Total != tc.want {
			t.Errorf("alert_type=%q: items=%d total=%d, want %d", tc.query, len(page.Items), page.Total, tc.want)
		}
	}
}
