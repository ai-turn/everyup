package database_test

import (
	"strconv"
	"testing"
	"time"

	"github.com/aiturn/everyup/internal/database"
	"github.com/aiturn/everyup/internal/models"
)

// makeTestService creates and inserts a minimal valid service for use in tests.
func makeTestService(t *testing.T, id string) {
	t.Helper()
	repo := database.NewServiceRepository()
	svc := &models.Service{
		ID:        id,
		Name:      "Test Service " + id,
		Type:      models.ServiceTypeHTTP,
		IsActive:  true,
		Interval:  60,
		Timeout:   30,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := repo.Create(svc); err != nil {
		t.Fatalf("failed to create test service %q: %v", id, err)
	}
}

// makeTestRequest returns a sample ApiRequest for insertion tests.
func makeTestRequest(serviceID string, method string, path string, statusCode int, isError bool, createdAt time.Time) models.ApiRequest {
	return models.ApiRequest{
		ServiceID:    serviceID,
		RequestID:    "req-" + path + "-" + method,
		Method:       method,
		Path:         path,
		PathTemplate: path,
		StatusCode:   statusCode,
		DurationMs:   50,
		ClientIP:     "127.0.0.1",
		IsError:      isError,
		CreatedAt:    createdAt,
	}
}

// --- TestApiRequestRepo_CreateAndGetByID ---

func TestApiRequestRepo_CreateAndGetByID(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-1")

	repo := database.NewApiRequestRepository()
	now := time.Now().Truncate(time.Second)
	req := makeTestRequest("svc-1", "GET", "/users/1", 200, false, now)

	if err := repo.Create(&req); err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if req.ID == 0 {
		t.Fatal("Create should set req.ID from LastInsertId, got 0")
	}

	got, err := repo.GetByID(req.ID)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if got == nil {
		t.Fatal("GetByID returned nil, expected record")
	}

	// Verify all fields round-trip correctly.
	if got.ServiceID != req.ServiceID {
		t.Errorf("ServiceID = %q, want %q", got.ServiceID, req.ServiceID)
	}
	if got.RequestID != req.RequestID {
		t.Errorf("RequestID = %q, want %q", got.RequestID, req.RequestID)
	}
	if got.Method != req.Method {
		t.Errorf("Method = %q, want %q", got.Method, req.Method)
	}
	if got.Path != req.Path {
		t.Errorf("Path = %q, want %q", got.Path, req.Path)
	}
	if got.PathTemplate != req.PathTemplate {
		t.Errorf("PathTemplate = %q, want %q", got.PathTemplate, req.PathTemplate)
	}
	if got.StatusCode != req.StatusCode {
		t.Errorf("StatusCode = %d, want %d", got.StatusCode, req.StatusCode)
	}
	if got.DurationMs != req.DurationMs {
		t.Errorf("DurationMs = %d, want %d", got.DurationMs, req.DurationMs)
	}
	if got.ClientIP != req.ClientIP {
		t.Errorf("ClientIP = %q, want %q", got.ClientIP, req.ClientIP)
	}
	if got.IsError != req.IsError {
		t.Errorf("IsError = %v, want %v", got.IsError, req.IsError)
	}
	if !got.CreatedAt.Equal(now) {
		t.Errorf("CreatedAt = %v, want %v", got.CreatedAt, now)
	}

}

func TestApiRequestRepo_GetByID_NotFound(t *testing.T) {
	openTestDB(t)

	repo := database.NewApiRequestRepository()
	got, err := repo.GetByID(999999)
	if err != nil {
		t.Fatalf("GetByID not-found should return nil,nil, got err: %v", err)
	}
	if got != nil {
		t.Fatalf("GetByID not-found should return nil, got %+v", got)
	}
}

// --- TestApiRequestRepo_CreateBatch ---

func TestApiRequestRepo_CreateBatch(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-batch")

	repo := database.NewApiRequestRepository()
	now := time.Now()

	reqs := []models.ApiRequest{
		makeTestRequest("svc-batch", "GET", "/a", 200, false, now),
		makeTestRequest("svc-batch", "POST", "/b", 201, false, now),
		makeTestRequest("svc-batch", "DELETE", "/c", 500, true, now),
	}

	count, err := repo.CreateBatch(reqs)
	if err != nil {
		t.Fatalf("CreateBatch failed: %v", err)
	}
	if count != 3 {
		t.Errorf("CreateBatch returned count = %d, want 3", count)
	}

	// List should return all 3.
	items, total, err := repo.List(&models.ApiRequestFilter{ServiceID: "svc-batch"})
	if err != nil {
		t.Fatalf("List after CreateBatch failed: %v", err)
	}
	if total != 3 {
		t.Errorf("total = %d, want 3", total)
	}
	if len(items) != 3 {
		t.Errorf("len(items) = %d, want 3", len(items))
	}
}

// --- TestApiRequestRepo_ListFilters ---

func TestApiRequestRepo_ListFilters(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-filter")

	repo := database.NewApiRequestRepository()
	base := time.Now().Add(-time.Hour)

	// Insert 5 rows: 2횞200, 1횞400 error, 1횞404 error, 1횞500 error
	rows := []models.ApiRequest{
		makeTestRequest("svc-filter", "GET", "/users", 200, false, base),
		makeTestRequest("svc-filter", "POST", "/users", 200, false, base.Add(time.Second)),
		makeTestRequest("svc-filter", "GET", "/users/bad", 400, true, base.Add(2*time.Second)),
		makeTestRequest("svc-filter", "GET", "/items/1", 404, true, base.Add(3*time.Second)),
		makeTestRequest("svc-filter", "POST", "/items", 500, true, base.Add(4*time.Second)),
	}
	_, err := repo.CreateBatch(rows)
	if err != nil {
		t.Fatalf("setup CreateBatch: %v", err)
	}

	t.Run("ErrorsOnly", func(t *testing.T) {
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID:  "svc-filter",
			ErrorsOnly: true,
		})
		if err != nil {
			t.Fatalf("List ErrorsOnly: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3", total)
		}
		for _, it := range items {
			if !it.IsError {
				t.Errorf("got non-error row in ErrorsOnly result: %+v", it)
			}
		}
	})

	t.Run("MinStatus400", func(t *testing.T) {
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-filter",
			MinStatus: 400,
		})
		if err != nil {
			t.Fatalf("List MinStatus=400: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3 (400, 404, 500)", total)
		}
		for _, it := range items {
			if it.StatusCode < 400 {
				t.Errorf("got status %d below min 400", it.StatusCode)
			}
		}
	})

	t.Run("PathPrefix_users", func(t *testing.T) {
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID:  "svc-filter",
			PathPrefix: "/users",
		})
		if err != nil {
			t.Fatalf("List PathPrefix=/users: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3 (/users, /users, /users/bad)", total)
		}
		for _, it := range items {
			if len(it.Path) < 6 || it.Path[:6] != "/users" {
				t.Errorf("path %q does not start with /users", it.Path)
			}
		}
	})

	t.Run("Pagination_Limit2Offset0", func(t *testing.T) {
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-filter",
			Limit:     2,
			Offset:    0,
		})
		if err != nil {
			t.Fatalf("List Limit=2: %v", err)
		}
		if total != 5 {
			t.Errorf("total = %d, want 5 (all rows)", total)
		}
		if len(items) != 2 {
			t.Errorf("len(items) = %d, want 2", len(items))
		}
	})

	t.Run("Methods_GET", func(t *testing.T) {
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-filter",
			Methods:   []string{"GET"},
		})
		if err != nil {
			t.Fatalf("List Methods=GET: %v", err)
		}
		if total != 3 {
			t.Errorf("total = %d, want 3 GET rows", total)
		}
		for _, it := range items {
			if it.Method != "GET" {
				t.Errorf("got method %q, want GET", it.Method)
			}
		}
	})
}

// --- TestApiRequestRepo_DeleteOlderThan ---

func TestApiRequestRepo_DeleteOlderThan(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-del")

	repo := database.NewApiRequestRepository()
	past := time.Now().Add(-2 * time.Hour)
	future := time.Now().Add(time.Hour)

	reqs := []models.ApiRequest{
		makeTestRequest("svc-del", "GET", "/old1", 200, false, past),
		makeTestRequest("svc-del", "GET", "/old2", 200, false, past.Add(time.Minute)),
		makeTestRequest("svc-del", "GET", "/old3", 200, false, past.Add(2*time.Minute)),
		makeTestRequest("svc-del", "GET", "/new1", 200, false, future),
	}
	_, err := repo.CreateBatch(reqs)
	if err != nil {
		t.Fatalf("setup CreateBatch: %v", err)
	}

	affected, err := repo.DeleteOlderThan(time.Now())
	if err != nil {
		t.Fatalf("DeleteOlderThan: %v", err)
	}
	if affected != 3 {
		t.Errorf("DeleteOlderThan affected = %d, want 3", affected)
	}

	// Only the future row should remain.
	items, total, err := repo.List(&models.ApiRequestFilter{ServiceID: "svc-del"})
	if err != nil {
		t.Fatalf("List after delete: %v", err)
	}
	if total != 1 {
		t.Errorf("total after delete = %d, want 1", total)
	}
	if len(items) != 1 || items[0].Path != "/new1" {
		t.Errorf("remaining item = %+v, want path=/new1", items)
	}
}

// --- TestApiRequestRepo_ListFilterExtended ---

func TestApiRequestRepo_ListFilterExtended(t *testing.T) {
	t.Run("Search_reqBody", func(t *testing.T) {
		openTestDB(t)
		makeTestService(t, "svc-search")

		repo := database.NewApiRequestRepository()
		now := time.Now()

		// Row with alice in req_body.
		r1 := makeTestRequest("svc-search", "POST", "/submit", 200, false, now)
		if err := repo.Create(&r1); err != nil {
			t.Fatalf("Create r1: %v", err)
		}

		// Row with /search/foo in path.
		r2 := makeTestRequest("svc-search", "GET", "/search/foo", 200, false, now.Add(time.Second))
		if err := repo.Create(&r2); err != nil {
			t.Fatalf("Create r2: %v", err)
		}

		// Search for "alice" ??should match r1 via req_body.
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-search",
			Search:    "submit",
		})
		if err != nil {
			t.Fatalf("List Search=submit: %v", err)
		}
		if total != 1 {
			t.Errorf("Search=submit: total = %d, want 1", total)
		}
		if len(items) == 1 && items[0].Path != "/submit" {
			t.Errorf("Search=submit: got path %q, want /submit", items[0].Path)
		}

		// Search for "foo" ??should match r2 via path.
		items2, total2, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-search",
			Search:    "foo",
		})
		if err != nil {
			t.Fatalf("List Search=foo: %v", err)
		}
		if total2 != 1 {
			t.Errorf("Search=foo: total = %d, want 1", total2)
		}
		if len(items2) == 1 && items2[0].Path != "/search/foo" {
			t.Errorf("Search=foo: got path %q, want /search/foo", items2[0].Path)
		}
	})

	t.Run("MaxStatus", func(t *testing.T) {
		openTestDB(t)
		makeTestService(t, "svc-maxstatus")

		repo := database.NewApiRequestRepository()
		now := time.Now()

		reqs := []models.ApiRequest{
			makeTestRequest("svc-maxstatus", "GET", "/a", 200, false, now),
			makeTestRequest("svc-maxstatus", "GET", "/b", 301, false, now.Add(time.Second)),
			makeTestRequest("svc-maxstatus", "GET", "/c", 404, true, now.Add(2*time.Second)),
		}
		if _, err := repo.CreateBatch(reqs); err != nil {
			t.Fatalf("CreateBatch: %v", err)
		}

		// MaxStatus=399 ??200 and 301 qualify.
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-maxstatus",
			MaxStatus: 399,
		})
		if err != nil {
			t.Fatalf("List MaxStatus=399: %v", err)
		}
		if total != 2 {
			t.Errorf("MaxStatus=399: total = %d, want 2 (200, 301)", total)
		}
		for _, it := range items {
			if it.StatusCode > 399 {
				t.Errorf("MaxStatus=399: got status %d above max", it.StatusCode)
			}
		}

		// MinStatus=200, MaxStatus=299 ??only 200 qualifies.
		items2, total2, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-maxstatus",
			MinStatus: 200,
			MaxStatus: 299,
		})
		if err != nil {
			t.Fatalf("List MinStatus=200 MaxStatus=299: %v", err)
		}
		if total2 != 1 {
			t.Errorf("MinStatus=200 MaxStatus=299: total = %d, want 1 (200 only)", total2)
		}
		if len(items2) == 1 && items2[0].StatusCode != 200 {
			t.Errorf("MinStatus=200 MaxStatus=299: got status %d, want 200", items2[0].StatusCode)
		}
	})

	t.Run("FromTo_time", func(t *testing.T) {
		openTestDB(t)
		makeTestService(t, "svc-fromto")

		now := time.Now().Truncate(time.Second)
		tMinus2h := now.Add(-2 * time.Hour)
		tMinus1h := now.Add(-time.Hour)
		tPlus1h := now.Add(time.Hour)

		// Insert directly with controlled created_at values.
		for _, row := range []struct {
			path      string
			createdAt time.Time
		}{
			{"/old", tMinus2h},
			{"/mid", tMinus1h},
			{"/new", tPlus1h},
		} {
			_, err := database.DB.Exec(`
				INSERT INTO api_requests
					(service_id, request_id, method, path, path_template,
					 status_code, duration_ms, client_ip,
					 is_error, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
				"svc-fromto", "req-"+row.path, "GET", row.path, row.path,
				200, 10, "127.0.0.1",
				0, row.createdAt,
			)
			if err != nil {
				t.Fatalf("INSERT %s: %v", row.path, err)
			}
		}

		repo := database.NewApiRequestRepository()

		// From=t-90min, To=t+2h ??should return /mid (t-1h) and /new (t+1h).
		from90 := now.Add(-90 * time.Minute)
		toPlus2h := now.Add(2 * time.Hour)
		items, total, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-fromto",
			From:      from90,
			To:        toPlus2h,
		})
		if err != nil {
			t.Fatalf("List From/To: %v", err)
		}
		if total != 2 {
			t.Errorf("From=-90min To=+2h: total = %d, want 2 (/mid, /new)", total)
		}

		// To=now ??should return /old (t-2h) and /mid (t-1h).
		items2, total2, err := repo.List(&models.ApiRequestFilter{
			ServiceID: "svc-fromto",
			To:        now,
		})
		if err != nil {
			t.Fatalf("List To=now: %v", err)
		}
		if total2 != 2 {
			t.Errorf("To=now: total = %d, want 2 (/old, /mid)", total2)
		}
		_ = items
		_ = items2
	})
}

func TestApiRequestRepo_CreateAgentRequestWithoutLegacyService(t *testing.T) {
	openTestDB(t)

	repo := database.NewApiRequestRepository()
	now := time.Now().Truncate(time.Second)
	req := models.ApiRequest{
		ServiceID:    "",
		AgentID:      "agent-1",
		ServiceName:  "demo",
		RequestID:    "agent-req-1",
		Method:       "GET",
		Path:         "/api/users",
		PathTemplate: "/api/users",
		StatusCode:   200,
		DurationMs:   12,
		ClientIP:     "127.0.0.1",
		CreatedAt:    now,
	}

	if err := repo.Create(&req); err != nil {
		t.Fatalf("Create agent request without legacy service failed: %v", err)
	}

	got, err := repo.GetByID(req.ID)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if got == nil {
		t.Fatal("GetByID returned nil")
	}
	if got.AgentID != req.AgentID || got.ServiceName != req.ServiceName || got.ServiceID != "" {
		t.Fatalf("unexpected ownership fields: got serviceID=%q agentID=%q serviceName=%q", got.ServiceID, got.AgentID, got.ServiceName)
	}
}

// --- TestApiRequestRepo_RequestStats ---

func TestApiRequestRepo_RequestStats(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-stats")

	repo := database.NewApiRequestRepository()
	base := time.Now().Truncate(time.Hour)

	mk := func(path string, status int, isErr bool, dur int, at time.Time) models.ApiRequest {
		return models.ApiRequest{
			ServiceID: "svc-stats", RequestID: path + at.String(), Method: "GET", Path: path,
			PathTemplate: path, StatusCode: status, DurationMs: dur, IsError: isErr, CreatedAt: at,
		}
	}

	// Bucket A (base): 10 timed requests 10..100ms + 2 errors, plus 1 untimed (dur 0).
	var rows []models.ApiRequest
	for i := 1; i <= 10; i++ {
		rows = append(rows, mk("/a", 200, false, i*10, base.Add(time.Duration(i)*time.Second)))
	}
	rows = append(rows,
		mk("/a", 500, true, 30, base.Add(20*time.Second)),
		mk("/a", 503, true, 40, base.Add(21*time.Second)),
		mk("/a", 200, false, 0, base.Add(22*time.Second)), // untimed (access-log style)
	)
	// Bucket B (base+10m): 1 request.
	rows = append(rows, mk("/b", 200, false, 5, base.Add(10*time.Minute)))

	if _, err := repo.CreateBatch(rows); err != nil {
		t.Fatalf("CreateBatch: %v", err)
	}

	stats, err := repo.RequestStats(&models.ApiRequestFilter{ServiceID: "svc-stats"}, 5)
	if err != nil {
		t.Fatalf("RequestStats: %v", err)
	}
	if len(stats) != 2 {
		t.Fatalf("buckets = %d, want 2", len(stats))
	}

	a := stats[0]
	if a.Count != 13 {
		t.Errorf("bucket A count = %d, want 13", a.Count)
	}
	if a.ErrorCount != 2 {
		t.Errorf("bucket A errors = %d, want 2", a.ErrorCount)
	}
	if a.Timed != 12 {
		t.Errorf("bucket A timed = %d, want 12 (untimed excluded)", a.Timed)
	}
	// 12 timed durations: 10,20,...,100,30,40 → p50 nearest-rank(ceil .5*12=6)→6th smallest.
	// sorted: 10,20,30,30,40,40,50,60,70,80,90,100 → 6th=40, p95(ceil .95*12=12)→100.
	if a.P50 != 40 {
		t.Errorf("bucket A p50 = %d, want 40", a.P50)
	}
	if a.P95 != 100 {
		t.Errorf("bucket A p95 = %d, want 100", a.P95)
	}

	if stats[1].Count != 1 {
		t.Errorf("bucket B count = %d, want 1", stats[1].Count)
	}
}

// P99 must separate from P95 once the bucket is big enough to have a tail.
func TestApiRequestRepo_RequestStats_P99(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-p99")

	repo := database.NewApiRequestRepository()
	base := time.Now().Truncate(time.Hour)
	var rows []models.ApiRequest
	for i := 1; i <= 100; i++ {
		rows = append(rows, models.ApiRequest{
			ServiceID: "svc-p99", RequestID: "r" + strconv.Itoa(i), Method: "GET", Path: "/t", PathTemplate: "/t",
			StatusCode: 200, DurationMs: i, CreatedAt: base.Add(time.Duration(i) * time.Second),
		})
	}
	if _, err := repo.CreateBatch(rows); err != nil {
		t.Fatalf("CreateBatch: %v", err)
	}

	stats, err := repo.RequestStats(&models.ApiRequestFilter{ServiceID: "svc-p99"}, 5)
	if err != nil {
		t.Fatalf("RequestStats: %v", err)
	}
	if len(stats) != 1 {
		t.Fatalf("buckets = %d, want 1", len(stats))
	}
	if stats[0].P95 != 95 || stats[0].P99 != 99 {
		t.Errorf("p95/p99 = %d/%d, want 95/99", stats[0].P95, stats[0].P99)
	}
}

// --- TestApiRequestRepo_RequestStats_ByAgent ---
// Project-level Requests trend: requests from multiple services under one agent
// roll up into the same time bucket, and other agents' requests are excluded.
func TestApiRequestRepo_RequestStats_ByAgent(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-a")
	makeTestService(t, "svc-b")

	repo := database.NewApiRequestRepository()
	base := time.Now().Truncate(time.Hour)

	mk := func(svc, agent, path string, status int, isErr bool, dur int, at time.Time) models.ApiRequest {
		return models.ApiRequest{
			ServiceID: svc, AgentID: agent, RequestID: svc + agent + path + at.String(),
			Method: "GET", Path: path, PathTemplate: path,
			StatusCode: status, DurationMs: dur, IsError: isErr, CreatedAt: at,
		}
	}

	rows := []models.ApiRequest{
		// agent-x, two services, same 5-min bucket → 5 requests, 1 error.
		mk("svc-a", "agent-x", "/a", 200, false, 10, base.Add(1*time.Second)),
		mk("svc-a", "agent-x", "/a", 200, false, 20, base.Add(2*time.Second)),
		mk("svc-a", "agent-x", "/a", 500, true, 30, base.Add(3*time.Second)),
		mk("svc-b", "agent-x", "/b", 200, false, 40, base.Add(4*time.Second)),
		mk("svc-b", "agent-x", "/b", 200, false, 50, base.Add(5*time.Second)),
		// different agent — must be excluded by the AgentID filter.
		mk("svc-a", "agent-other", "/a", 200, false, 99, base.Add(6*time.Second)),
	}
	if _, err := repo.CreateBatch(rows); err != nil {
		t.Fatalf("CreateBatch: %v", err)
	}

	stats, err := repo.RequestStats(&models.ApiRequestFilter{AgentID: "agent-x"}, 5)
	if err != nil {
		t.Fatalf("RequestStats: %v", err)
	}
	if len(stats) != 1 {
		t.Fatalf("buckets = %d, want 1", len(stats))
	}
	if stats[0].Count != 5 {
		t.Errorf("agent-x bucket count = %d, want 5 (both services, other agent excluded)", stats[0].Count)
	}
	if stats[0].ErrorCount != 1 {
		t.Errorf("agent-x bucket errors = %d, want 1", stats[0].ErrorCount)
	}
}

// Status-class distribution + top 5xx endpoint over a filter window.
func TestApiRequestRepo_StatusSummary(t *testing.T) {
	openTestDB(t)
	makeTestService(t, "svc-a")

	repo := database.NewApiRequestRepository()
	base := time.Now().Truncate(time.Hour)
	mk := func(id, method, path string, status int, at time.Time) models.ApiRequest {
		return models.ApiRequest{
			ServiceID: "svc-a", AgentID: "agent-x", RequestID: id,
			Method: method, Path: path, PathTemplate: path,
			StatusCode: status, IsError: status >= 500, CreatedAt: at,
		}
	}
	rows := []models.ApiRequest{
		mk("r1", "GET", "/ok", 200, base),
		mk("r2", "GET", "/ok", 200, base),
		mk("r3", "GET", "/moved", 301, base),
		mk("r4", "GET", "/missing", 404, base),
		mk("r5", "POST", "/pay", 500, base),
		mk("r6", "POST", "/pay", 502, base),
		mk("r7", "GET", "/other-5xx", 500, base),
		// outside the window — excluded by From
		mk("r8", "GET", "/old", 500, base.Add(-2*time.Hour)),
		// different agent — excluded by AgentID
		mk("r9", "GET", "/foreign", 500, base),
	}
	// give the foreign row a different agent
	rows[8].AgentID = "agent-other"
	if _, err := repo.CreateBatch(rows); err != nil {
		t.Fatalf("CreateBatch: %v", err)
	}

	sum, err := repo.StatusSummary(&models.ApiRequestFilter{AgentID: "agent-x", From: base.Add(-time.Hour)})
	if err != nil {
		t.Fatalf("StatusSummary: %v", err)
	}
	if sum.Count2xx != 2 || sum.Count3xx != 1 || sum.Count4xx != 1 || sum.Count5xx != 3 {
		t.Errorf("class counts = 2xx:%d 3xx:%d 4xx:%d 5xx:%d, want 2/1/1/3", sum.Count2xx, sum.Count3xx, sum.Count4xx, sum.Count5xx)
	}
	if sum.Top5xxMethod != "POST" || sum.Top5xxPath != "/pay" || sum.Top5xxCount != 2 {
		t.Errorf("top 5xx = %s %s ×%d, want POST /pay ×2", sum.Top5xxMethod, sum.Top5xxPath, sum.Top5xxCount)
	}
}
