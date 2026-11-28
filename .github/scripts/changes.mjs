import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function deploymentChanges(paths) {
  return { images: paths.some(path => /^(web\/|agent\/|\.github\/|\.dockerignore$)/.test(path)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  // Release runs (tag pushes, manual runs) have no diff base and always smoke-test the images.
  let changes = { images: true };
  const base = process.env.GITHUB_EVENT_NAME === 'pull_request' ? event.pull_request.base.sha : event.before;
  if (base && !/^0+$/.test(base) && !process.env.GITHUB_REF.startsWith('refs/tags/')) {
    const paths = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { encoding: 'utf8' }).trim().split('\n');
    changes = deploymentChanges(paths);
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `images=${changes.images}\n`);
}
