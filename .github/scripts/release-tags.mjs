// Docker tags a release tag publishes. Only release tags publish; pushes to main move nothing.
// latest and the MAJOR.MINOR alias move only for a stable version that no existing stable tag
// outranks, so re-releasing an old version or cutting a prerelease never moves them.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function parse(tag) {
  const match = SEMVER.exec(tag);
  if (!match || match[4]?.split('.').some(part => /^0\d+$/.test(part))) return null;
  return { version: tag.slice(1), core: match.slice(1, 4).map(Number), prerelease: match[4] };
}

const newer = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export function releaseTags(ref, existingTags = []) {
  const release = ref.startsWith('refs/tags/') && parse(ref.slice('refs/tags/'.length));
  if (!release) throw new Error('Release tags must be vMAJOR.MINOR.PATCH, optionally followed by a SemVer prerelease.');
  if (release.prerelease) return [release.version];
  const [major, minor] = release.core;
  const stable = existingTags.map(parse).filter(tag => tag && !tag.prerelease).map(tag => tag.core);
  const tags = [release.version];
  if (!stable.some(core => core[0] === major && core[1] === minor && newer(core, release.core) > 0)) tags.push(`${major}.${minor}`);
  if (!stable.some(core => newer(core, release.core) > 0)) tags.push('latest');
  return tags;
}

export const remoteTags = () => execFileSync('git', ['ls-remote', '--tags', '--refs', 'origin'], { encoding: 'utf8' })
  .split('\n').filter(Boolean).map(line => line.split('\trefs/tags/')[1]);

// `node release-tags.mjs v1.2.3` prints the image tags that release would publish, one per line.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(releaseTags(`refs/tags/${process.argv[2]}`, remoteTags()).join('\n'));
}
