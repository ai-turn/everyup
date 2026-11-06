// latest tracks main only. Publishing an old version must never move latest.
export function releaseTags(ref, currentMain = true) {
  if (ref === 'refs/heads/main') return currentMain ? ['latest'] : [];
  const match = /^refs\/tags\/v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(ref);
  if (!match || match[4]?.split('.').some(part => /^0\d+$/.test(part))) {
    throw new Error('Release tags must be vMAJOR.MINOR.PATCH, optionally followed by a SemVer prerelease.');
  }
  const version = ref.slice('refs/tags/v'.length);
  return match[4] ? [version] : [version, `${match[1]}.${match[2]}`];
}
