import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentChanges } from './changes.mjs';
import { releaseTags } from './release-tags.mjs';

test('docs-only changes do not rebuild Docker images', () => {
  assert.deepEqual(deploymentChanges(['docs/guide/introduction.md']), { images: false, pages: true });
});
test('backend and Collector changes do not redeploy Pages', () => {
  assert.deepEqual(deploymentChanges(['web/backend/cmd/server/main.go', 'agent/Dockerfile']), { images: true, pages: false });
});
test('frontend and deployment changes update both products', () => {
  for (const path of ['web/frontend/src/App.tsx', '.github/workflows/ci.yml', '.github/scripts/assemble-pages.mjs']) {
    assert.deepEqual(deploymentChanges([path]), { images: true, pages: true });
  }
});
test('only the current main commit can update latest', () => {
  assert.deepEqual(releaseTags('refs/heads/main'), ['latest']);
  assert.deepEqual(releaseTags('refs/heads/main', false), []);
  assert.deepEqual(releaseTags('refs/tags/v1.2.3'), ['1.2.3', '1.2']);
});
test('prereleases cannot move stable aliases', () => {
  assert.deepEqual(releaseTags('refs/tags/v1.2.3-rc.1'), ['1.2.3-rc.1']);
});
test('invalid or unsupported refs cannot publish release aliases', () => {
  for (const ref of ['refs/heads/feature', 'refs/tags/vfoo', 'refs/tags/v01.2.3', 'refs/tags/v1.2.3-rc.01', 'refs/tags/v1.2']) {
    assert.throws(() => releaseTags(ref));
  }
});
