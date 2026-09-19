// export_test.go exposes unexported functions for white-box testing.
// This file is compiled only during tests (package database, not database_test).
package database

// MigrateV20ForTest re-runs migrateV20 on the already-open DB.
// Used to verify the migration is idempotent (safe to run twice).
var MigrateV20ForTest = migrateV20

// MigrateV52ForTest and MigrateV53ForTest re-run the telemetry migrations.
// Both add columns/indexes to tables that already exist in an upgraded
// install, so re-running them must be a no-op rather than an error.
var (
	MigrateV52ForTest = migrateV52
	MigrateV53ForTest = migrateV53
)
