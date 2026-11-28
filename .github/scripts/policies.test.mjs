import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentChanges } from './changes.mjs';
import { releaseTags } from './release-tags.mjs';
import { artifactName, findReusableRun } from './reuse-e2e.mjs';

test('docs-only changes do not rebuild Docker images', () => {
  assert.deepEqual(deploymentChanges(['docs/guide/introduction.md', 'README.md']), { images: false });
});
test('product and deployment changes smoke-test the images', () => {
  for (const path of ['web/frontend/src/App.tsx', 'agent/Dockerfile', '.github/workflows/ci.yml', '.dockerignore']) {
    assert.deepEqual(deploymentChanges([path]), { images: true });
  }
});
test('the newest stable release moves its minor alias and latest', () => {
  assert.deepEqual(releaseTags('refs/tags/v1.2.3'), ['1.2.3', '1.2', 'latest']);
  // Prereleases and non-release tags never outrank a stable version.
  assert.deepEqual(releaseTags('refs/tags/v1.2.3', ['v1.2.3', 'v1.2.2', 'v2.0.0-rc.1', 'v0.9.0-legacy-ui', 'nightly']), ['1.2.3', '1.2', 'latest']);
});
test('re-releasing an older stable version cannot roll back latest or its minor alias', () => {
  assert.deepEqual(releaseTags('refs/tags/v1.2.3', ['v1.3.0']), ['1.2.3', '1.2']);
  assert.deepEqual(releaseTags('refs/tags/v1.2.3', ['v1.2.4']), ['1.2.3']);
});
test('prereleases publish only their own version tag', () => {
  assert.deepEqual(releaseTags('refs/tags/v1.2.3-rc.1'), ['1.2.3-rc.1']);
  assert.deepEqual(releaseTags('refs/tags/v0.9.0-legacy-ui'), ['0.9.0-legacy-ui']);
});
test('main and invalid refs cannot publish any image tag', () => {
  for (const ref of ['refs/heads/main', 'refs/heads/feature', 'refs/tags/vfoo', 'refs/tags/v01.2.3', 'refs/tags/v1.2.3-rc.01', 'refs/tags/v1.2']) {
    assert.throws(() => releaseTags(ref), undefined, ref);
  }
});

const tree = 'a'.repeat(40);
const reuseInput = (run, extra = {}) => ({
  tree, repository: 'o/r', workflowPath: '.github/workflows/ci.yml', currentRunId: 9,
  artifacts: [{ name: artifactName(tree), workflow_run: { id: 1 } }],
  runs: { 1: { id: 1, event: 'pull_request', path: '.github/workflows/ci.yml', head_repository: { full_name: 'o/r' }, status: 'completed', conclusion: 'success', ...run } },
  ...extra,
});
test('main reuses a successful same-repo PR run that passed e2e on the same tree', () => {
  assert.equal(findReusableRun(reuseInput()).run.id, 1);
});
test('main runs e2e unless the PR run is complete, successful, and from this workflow and repo', () => {
  for (const run of [{ status: 'in_progress', conclusion: null }, { conclusion: 'failure' }, { conclusion: 'cancelled' },
    { event: 'push' }, { path: '.github/workflows/other.yml' }, { head_repository: { full_name: 'fork/r' } }]) {
    assert.equal(findReusableRun(reuseInput(run)).run, undefined, JSON.stringify(run));
  }
});
test('main runs e2e for a new tree or when the only record is its own run', () => {
  assert.equal(findReusableRun(reuseInput({}, { artifacts: [] })).run, undefined);
  assert.equal(findReusableRun(reuseInput({}, { artifacts: [{ name: artifactName('b'.repeat(40)), workflow_run: { id: 1 } }] })).run, undefined);
  assert.equal(findReusableRun(reuseInput({}, { currentRunId: 1 })).run, undefined);
});
test('a qualifying run is found past rejected ones', () => {
  const input = reuseInput({ conclusion: 'failure' });
  input.artifacts.push({ name: artifactName(tree), workflow_run: { id: 2 } });
  input.runs[2] = { ...input.runs[1], id: 2, conclusion: 'success' };
  assert.equal(findReusableRun(input).run.id, 2);
});
