import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseTags } from './release-tags.mjs';

export function deploymentChanges(paths) {
  return {
    images: paths.some(path => /^(web\/|agent\/|\.github\/|\.dockerignore$)/.test(path)),
    pages: paths.some(path => /^(web\/frontend\/|docs\/|\.github\/)/.test(path)),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Invalid release tags fail before any build or registry write.
  if (process.env.GITHUB_REF?.startsWith('refs/tags/')) releaseTags(process.env.GITHUB_REF);
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  let changes = { images: true, pages: true };
  const base = process.env.GITHUB_EVENT_NAME === 'pull_request' ? event.pull_request.base.sha : event.before;
  if (base && !/^0+$/.test(base) && !process.env.GITHUB_REF.startsWith('refs/tags/')) {
    const paths = execFileSync('git', ['diff', '--name-only', base, process.env.GITHUB_SHA], { encoding: 'utf8' }).trim().split('\n');
    changes = deploymentChanges(paths);
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `images=${changes.images}\npages=${changes.pages}\n`);
}
