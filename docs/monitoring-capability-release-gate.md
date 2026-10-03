# Monitoring capability release gate

Run this gate before releasing capability navigation, Docker collection profiles, independent uptime, or Project grouping changes.

1. `cd web/backend && go test ./... && go vet ./...`
2. `pnpm --dir web/frontend install --frozen-lockfile && pnpm --dir web/frontend lint && pnpm --dir web/frontend typecheck && pnpm --dir web/frontend build`
3. Install Chromium once with `pnpm --dir web/frontend exec playwright install chromium`, then run `pnpm --dir web/frontend test:e2e` to verify the built demo at `/everyup/demo/`.
4. With Docker Engine running, execute the profile compose checks in `web/backend/internal/api/handlers`; they validate all-in-one, Basic, and reduced custom bundles.
5. With an installed `everyup-otel` helper and Docker Engine, run `e2e/monitoring-target/scripts/run-e2e.sh --with-auto-rollback`.
6. In desktop and mobile browser layouts, check **Docker -> Connect Docker**, the all-in-one Docker collector installer, a reduced Docker collection profile installer, directly configured HTTP/TCP monitor creation, capability deep links, `/projects`, and legacy `/projects/:agentId` redirects.
7. Switch between English and Korean and verify that product copy uses Docker Environment / Docker Collector and Docker 환경 / Docker 수집기 consistently.

The `Verify` workflow enforces backend and generated compose checks on every main-branch push and pull request, and frontend checks on pull requests. For main-branch frontend changes, `Deploy Docs and Demo to GitHub Pages` runs lint, typecheck, the demo build, and Playwright before uploading the same tested artifact. The full runtime e2e command remains a release-environment gate because it needs Docker plus the installed helper.
