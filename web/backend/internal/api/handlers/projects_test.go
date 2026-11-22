package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProjectGroupsAgentsAndIndependentMonitors(t *testing.T) {
	ts := setupTestServer(t)
	token := ts.setupAdmin(t, "admin", "testpass123")
	auth := authHeader(token)

	_, projectResult := ts.doRequest(t, "POST", "/api/v1/projects", map[string]string{
		"name": "Production", "description": "customer-facing workloads",
	}, auth...)
	if !projectResult.Success {
		t.Fatalf("create project: %+v", projectResult.Error)
	}
	var project struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(projectResult.Data, &project); err != nil || project.ID == "" {
		t.Fatalf("invalid project response: %v, %s", err, projectResult.Data)
	}

	_, agentResult := ts.doRequest(t, "POST", "/api/v1/agents", map[string]interface{}{
		"name": "prod-host", "profile": map[string]interface{}{"kind": "custom", "capabilities": []string{"infrastructure"}},
	}, auth...)
	if !agentResult.Success {
		t.Fatalf("create agent: %+v", agentResult.Error)
	}
	var agent struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(agentResult.Data, &agent); err != nil || agent.ID == "" {
		t.Fatalf("invalid agent response: %v, %s", err, agentResult.Data)
	}

	_, monitorResult := ts.doRequest(t, "POST", "/api/v1/services", map[string]interface{}{
		"name": "public-dns", "type": "tcp", "host": "1.1.1.1", "port": 53, "interval": 5,
	}, auth...)
	if !monitorResult.Success {
		t.Fatalf("create monitor: %+v", monitorResult.Error)
	}
	var monitor struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(monitorResult.Data, &monitor); err != nil || monitor.ID == "" {
		t.Fatalf("invalid monitor response: %v, %s", err, monitorResult.Data)
	}

	_, observedResult := ts.doRequest(t, "POST", "/api/v1/observed-services", map[string]interface{}{
		"name": "checkout-api", "projectId": project.ID, "signals": []string{"logs"},
	}, auth...)
	if !observedResult.Success {
		t.Fatalf("create observed service: %+v", observedResult.Error)
	}
	var observed struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(observedResult.Data, &observed); err != nil || observed.ID == "" {
		t.Fatalf("invalid observed service response: %v, %s", err, observedResult.Data)
	}

	_, infrastructureResult := ts.doRequest(t, "POST", "/api/v1/infrastructure-resources", map[string]interface{}{
		"name": "edge-host", "projectId": project.ID,
	}, auth...)
	if !infrastructureResult.Success {
		t.Fatalf("create infrastructure resource: %+v", infrastructureResult.Error)
	}
	var infrastructure struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(infrastructureResult.Data, &infrastructure); err != nil || infrastructure.ID == "" {
		t.Fatalf("invalid infrastructure response: %v, %s", err, infrastructureResult.Data)
	}

	for _, endpoint := range []string{
		"/api/v1/projects/" + project.ID + "/agents/" + agent.ID,
		"/api/v1/projects/" + project.ID + "/monitors/" + monitor.ID,
	} {
		_, result := ts.doRequest(t, "PUT", endpoint, nil, auth...)
		if !result.Success {
			t.Fatalf("assign %s: %+v", endpoint, result.Error)
		}
	}

	_, listResult := ts.doRequest(t, "GET", "/api/v1/projects", nil, auth...)
	if !listResult.Success {
		t.Fatalf("list projects: %+v", listResult.Error)
	}
	var projects []struct {
		ID                          string `json:"id"`
		AgentCount                  int    `json:"agentCount"`
		MonitorCount                int    `json:"monitorCount"`
		ObservedServiceCount        int    `json:"observedServiceCount"`
		InfrastructureResourceCount int    `json:"infrastructureResourceCount"`
	}
	if err := json.Unmarshal(listResult.Data, &projects); err != nil {
		t.Fatal(err)
	}
	if len(projects) != 1 || projects[0].ID != project.ID || projects[0].AgentCount != 1 || projects[0].MonitorCount != 1 ||
		projects[0].ObservedServiceCount != 1 || projects[0].InfrastructureResourceCount != 1 {
		t.Fatalf("unexpected project rollup: %+v", projects)
	}

	_, resourcesResult := ts.doRequest(t, "GET", "/api/v1/infrastructure-resources", nil, auth...)
	var resources []struct {
		ID       string `json:"id"`
		Adapter  string `json:"adapter"`
		ServerID string `json:"serverId"`
	}
	if err := json.Unmarshal(resourcesResult.Data, &resources); err != nil {
		t.Fatal(err)
	}
	adapters := map[string]string{}
	for _, resource := range resources {
		adapters[resource.ID] = resource.Adapter
	}
	// A Docker environment is a server (ADR 0012): its host belongs to that server, which has its id.
	for _, resource := range resources {
		if resource.ID == agent.ID && resource.ServerID != agent.ID {
			t.Fatalf("Docker host serverId = %q, want %q", resource.ServerID, agent.ID)
		}
	}
	if adapters[agent.ID] != "everyup-agent" || adapters[infrastructure.ID] != "otel-collector" {
		t.Fatalf("shared infrastructure adapters: %+v", resources)
	}

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/v1/projects/"+project.ID, nil)
	deleteReq.Header.Set("Authorization", "Bearer "+token)
	deleteResp, err := ts.App.Test(deleteReq)
	if err != nil {
		t.Fatal(err)
	}
	defer deleteResp.Body.Close()
	if deleteResp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete project status=%d, want 204", deleteResp.StatusCode)
	}

	_, agentsResult := ts.doRequest(t, "GET", "/api/v1/agents", nil, auth...)
	var agents []struct {
		ID        string `json:"id"`
		ProjectID string `json:"projectId"`
	}
	if err := json.Unmarshal(agentsResult.Data, &agents); err != nil {
		t.Fatal(err)
	}
	if len(agents) != 1 || agents[0].ProjectID != "" {
		t.Fatalf("project deletion must leave agent unassigned: %+v", agents)
	}

	_, monitorsResult := ts.doRequest(t, "GET", "/api/v1/services?type=http,tcp", nil, auth...)
	var monitors []struct {
		ID        string `json:"id"`
		ProjectID string `json:"projectId"`
	}
	if err := json.Unmarshal(monitorsResult.Data, &monitors); err != nil {
		t.Fatal(err)
	}
	if len(monitors) != 1 || monitors[0].ID != monitor.ID || monitors[0].ProjectID != "" {
		t.Fatalf("project deletion must leave uptime monitor unassigned: %+v", monitors)
	}

	_, observedListResult := ts.doRequest(t, "GET", "/api/v1/observed-services", nil, auth...)
	var observedServices []struct {
		ID        string `json:"id"`
		ProjectID string `json:"projectId"`
	}
	if err := json.Unmarshal(observedListResult.Data, &observedServices); err != nil {
		t.Fatal(err)
	}
	if len(observedServices) != 1 || observedServices[0].ID != observed.ID || observedServices[0].ProjectID != "" {
		t.Fatalf("project deletion must leave observed service unassigned: %+v", observedServices)
	}

	_, infrastructureListResult := ts.doRequest(t, "GET", "/api/v1/infrastructure-resources", nil, auth...)
	var infrastructureResources []struct {
		ID        string `json:"id"`
		ProjectID string `json:"projectId"`
	}
	if err := json.Unmarshal(infrastructureListResult.Data, &infrastructureResources); err != nil {
		t.Fatal(err)
	}
	for _, resource := range infrastructureResources {
		if resource.ID == infrastructure.ID && resource.ProjectID != "" {
			t.Fatalf("project deletion must leave collector unassigned: %+v", infrastructureResources)
		}
	}
}
