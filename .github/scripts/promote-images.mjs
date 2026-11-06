import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { releaseTags } from './release-tags.mjs';

const { GITHUB_REF: ref, GITHUB_SHA: commit } = process.env;
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid source commit.');
let currentMain = true;
if (ref === 'refs/heads/main') {
  const head = execFileSync('git', ['ls-remote', '--exit-code', 'origin', 'refs/heads/main'], { encoding: 'utf8' }).split(/\s+/)[0];
  currentMain = head === commit;
}
const tags = releaseTags(ref, currentMain);
// Validate both digests before modifying either shared tag.
const images = ['web', 'agent'].map(kind => {
  const image = kind === 'web' ? 'aiturn/everyup' : 'aiturn/everyup-agent';
  const digest = readFileSync(`digest-${kind}.txt`, 'utf8').trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error(`Invalid ${kind} digest.`);
  return { image, digest, reference: `${image}@${digest}`, commitTag: `${image}:sha-${commit}` };
});
for (const tag of tags) {
  for (const image of images) {
    execFileSync('docker', ['buildx', 'imagetools', 'create', '--tag', `${image.image}:${tag}`, image.reference], { stdio: 'inherit' });
  }
}
writeFileSync('release-manifest.json', JSON.stringify({ commit, ref, tags, images }, null, 2) + '\n');
appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  `### Docker images\n\nCommit: \`${commit}\`\n\n` +
  images.map(image => `- \`${image.reference}\`\n`).join('') +
  `\nUpdated tags: ${tags.length ? tags.map(tag => `\`${tag}\``).join(', ') : 'none (main has advanced; commit images remain available)'}\n`);
