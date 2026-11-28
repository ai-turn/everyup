# Monitoring capability release gate

Run this gate before releasing capability navigation, Docker collection profiles, independent uptime, or server navigation changes.

1. `cd web/backend && go test ./... && go vet ./...`
2. `pnpm --dir web/frontend install --frozen-lockfile && pnpm --dir web/frontend lint && pnpm --dir web/frontend typecheck && pnpm --dir web/frontend build`
3. Install Chromium once with `pnpm --dir web/frontend exec playwright install chromium`, then run `pnpm --dir web/frontend test:e2e` to verify the built demo at `/everyup/demo/`.
4. With Docker Engine running, execute the profile compose checks in `web/backend/internal/api/handlers`; they validate all-in-one, Basic, and reduced custom bundles.
5. With an installed `everyup-otel` helper and Docker Engine, run `e2e/monitoring-target/scripts/run-e2e.sh --with-auto-rollback`.
6. In desktop and mobile browser layouts, check **Docker -> Connect Docker**, the all-in-one Docker collector installer, a reduced Docker collection profile installer, directly configured HTTP/TCP monitor creation, capability deep links, and the legacy `/projects` (server list) and `/projects/:agentId` (its server) redirects.
7. Switch between English and Korean and verify that product copy uses Docker Environment / Docker Collector and Docker 환경 / Docker 수집기 consistently.

The `Verify` workflow runs backend tests/vet, agent tests/vet/build, frontend lint/typecheck/production build/demo E2E, the docs build, image smoke tests, and generated compose checks on pull requests and main pushes. It never publishes. `Release` runs only for `v*` tags (pushed, or chosen in a manual run): it calls `Verify` on the tagged commit and publishes Docker images only after every check succeeds.

`Deploy demo` builds the docs and demo from one ref, runs Playwright on that demo build, and deploys it to GitHub Pages. It runs by hand with any ref, and automatically for a pushed tag that is the newest stable release. The full runtime e2e command remains a release-environment gate because it needs Docker plus the installed helper.
