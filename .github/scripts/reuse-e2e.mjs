// Decides whether a main push may skip e2e because a pull_request run of this workflow already
// passed e2e on the exact same git tree. Matching on the tree (not the commit) means the merged
// code, the workflow file, and the Playwright config and specs are byte-for-byte what was tested.
//
// Every PR run records the tree it tested (the refs/pull/N/merge checkout, not the PR head) as an
// artifact named `e2e-passed-tree-<tree>` right after e2e passes. A main push looks that name up
// and accepts a run only if it is a completed, successful pull_request run of this same workflow
// from a branch of this repository; anything else, including any API error, runs e2e.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const artifactName = tree => `e2e-passed-tree-${tree}`;

// Returns the run whose e2e result a main push may reuse, or why there is none.
export function findReusableRun({ tree, repository, workflowPath, currentRunId, artifacts, runs }) {
  const rejected = [];
  for (const artifact of artifacts) {
    if (artifact.name !== artifactName(tree)) continue;
    const id = artifact.workflow_run?.id;
    if (id === currentRunId) continue;
    const run = runs[id];
    const problem = !run ? 'run not found'
      : run.event !== 'pull_request' ? `event is ${run.event}`
      : run.path !== workflowPath ? `workflow is ${run.path}`
      : run.head_repository?.full_name !== repository ? 'run is from a fork'
      : run.status !== 'completed' ? `run is ${run.status}`
      : run.conclusion !== 'success' ? `run concluded ${run.conclusion}`
      : null;
    if (!problem) return { run };
    rejected.push(`run ${id}: ${problem}`);
  }
  return { reason: rejected.length ? `no qualifying run (${rejected.join('; ')})` : 'no pull_request run passed e2e on this tree' };
}

async function github(path) {
  const response = await fetch(`${process.env.GITHUB_API_URL}${path}`, {
    headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' },
  });
  if (!response.ok) throw new Error(`GET ${path}: ${response.status}`);
  return response.json();
}

async function decide({ event, ref, tree }) {
  const dryRun = event === 'pull_request';
  if (event === 'workflow_dispatch') return { reuse: false, reason: 'manual run always runs e2e' };
  if (!dryRun && !(event === 'push' && ref === 'refs/heads/main')) return { reuse: false, reason: `${event} on ${ref} always runs e2e` };
  if (process.env.FORCE_E2E === 'true') return { reuse: false, reason: 'FORCE_E2E is set' };
  const repository = process.env.GITHUB_REPOSITORY;
  // GITHUB_WORKFLOW_REF is "owner/repo/.github/workflows/ci.yml@refs/...".
  const workflowPath = process.env.GITHUB_WORKFLOW_REF.slice(repository.length + 1).split('@')[0];
  const { artifacts } = await github(`/repos/${repository}/actions/artifacts?per_page=100&name=${artifactName(tree)}`);
  const runs = {};
  for (const id of new Set(artifacts.map(artifact => artifact.workflow_run?.id).filter(Boolean))) {
    runs[id] = await github(`/repos/${repository}/actions/runs/${id}`);
  }
  const found = findReusableRun({ tree, repository, workflowPath, currentRunId: Number(process.env.GITHUB_RUN_ID), artifacts, runs });
  // PR runs only report what a main push with this tree would do; they always run e2e.
  return { reuse: !dryRun && Boolean(found.run), dryRun, ...found };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { GITHUB_EVENT_NAME: event, GITHUB_REF: ref } = process.env;
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  let decision;
  try {
    decision = await decide({ event, ref, tree });
  } catch (error) {
    decision = { reuse: false, reason: `lookup failed (${error.message})` };
  }
  const { reuse, dryRun, run, reason } = decision;
  const reused = run && `[run ${run.id}](${run.html_url}) (PR head \`${run.head_sha}\`, #${run.run_number} attempt ${run.run_attempt})`;
  const verdict = reuse ? `Skipped: reusing e2e from ${reused}.`
    : dryRun ? `Dry run (pull_request always runs e2e). A main push with this tree would ${run ? `reuse ${reused}` : `run e2e: ${reason}`}.`
    : `Running e2e: ${reason}.`;
  console.log(verdict);
  appendFileSync(process.env.GITHUB_OUTPUT, `reuse=${reuse}\ntree=${tree}\n`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### e2e\n\nTree: \`${tree}\`\n\n${verdict}\n`);
}
