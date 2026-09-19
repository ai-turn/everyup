package database_test

import (
	"testing"

	"github.com/aiturn/everyup/internal/database"
)

// Migrations re-run on every start, so an upgraded install executes these
// against tables that already carry the columns. They must tolerate that.
func TestTelemetryMigrationsAreIdempotent(t *testing.T) {
	openTestDB(t)

	for _, migration := range []struct {
		name string
		run  func() error
	}{
		{"v52", database.MigrateV52ForTest},
		{"v53", database.MigrateV53ForTest},
	} {
		if err := migration.run(); err != nil {
			t.Fatalf("%s re-run failed: %v", migration.name, err)
		}
		if err := migration.run(); err != nil {
			t.Fatalf("%s third run failed: %v", migration.name, err)
		}
	}

	// The columns the quantile and exemplar paths read must exist afterwards.
	for _, column := range []string{"bucket_bounds", "bucket_counts", "temporality", "exemplars"} {
		var count int
		if err := database.DB.QueryRow(
			`SELECT COUNT(*) FROM pragma_table_info('otel_metrics') WHERE name = ?`, column,
		).Scan(&count); err != nil {
			t.Fatalf("pragma_table_info(%s): %v", column, err)
		}
		if count != 1 {
			t.Errorf("otel_metrics.%s present %d times, want exactly 1", column, count)
		}
	}
}
