import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const upstream = 'vaibhav-kakde-in/mdhero';
const stateFile = '.github/upstream-release.json';
const localeFiles = ['src/lib/i18n/locales/en.json', 'src/lib/i18n/locales/zh-CN.json'];
export const ownedPaths = [
  '.github/workflows',
  '.github/scripts/sync-upstream-release.mjs',
  '.github/scripts/sync-upstream-release.test.mjs',
  stateFile,
  'README_CN.md',
  'src/lib/i18n/locales/zh-CN.json',
];

const exec = (file, args, cwd = root) => execFileSync(file, args, { cwd, encoding: 'utf8' }).trim();
const git = (args, cwd = root) => exec('git', args, cwd);
function summary(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, message + '\n');
}

export function isNewRelease(release, state) {
  if (!Number.isSafeInteger(release.id) || !Number.isSafeInteger(state.release_id)) throw new Error('Invalid release ID.');
  return !release.draft && !release.prerelease && release.id > state.release_id;
}

export function changedDictionaries(before, after) {
  return localeFiles.filter((file) => !isDeepStrictEqual(before[file], after[file]));
}

export function checkI18n(repo, approvedSha, candidateSha) {
  if (![approvedSha, candidateSha].every((sha) => /^[0-9a-f]{40}$/.test(sha))) throw new Error('Invalid upstream commit SHA.');
  try {
    git(['cat-file', '-e', `${approvedSha}^{commit}`], repo);
  } catch {
    git(['fetch', '--no-tags', `https://github.com/${upstream}.git`, approvedSha], repo);
  }
  const read = (sha) => Object.fromEntries(localeFiles.map((file) => {
    let text;
    try { text = git(['show', `${sha}:${file}`], repo); }
    catch { throw new Error(`Required language file is missing: ${sha}:${file}. Do not build an English-only release.`); }
    return [file, JSON.parse(text)];
  }));
  const changed = changedDictionaries(read(approvedSha), read(candidateSha));
  if (changed.length) {
    console.log(git(['diff', '--no-color', approvedSha, candidateSha, '--', ...changed], repo));
    throw new Error(`Language dictionary content changed: ${changed.join(', ')}. Review the diff and zh-CN.json before updating reviewed_i18n_commit. Approved: ${approvedSha}; candidate: ${candidateSha}.`);
  }
  console.log('Upstream English and Chinese dictionaries match the reviewed baseline (formatting and key order ignored).');
}

export function syncTree(repo, upstreamSha) {
  // This runs in a fresh CI checkout; preserve only our CI, documentation and Chinese file.
  git(['read-tree', '--reset', '-u', upstreamSha], repo);
  git(['restore', '--source=HEAD', '--staged', '--worktree', '--', ...ownedPaths], repo);
}

function main() {
  const state = JSON.parse(readFileSync(resolve(root, stateFile), 'utf8'));
  if (process.argv[2] === '--check-i18n') {
    const repo = resolve(process.argv[3] || '.');
    checkI18n(repo, state.reviewed_i18n_commit, git(['rev-parse', 'HEAD'], repo));
    return;
  }
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) throw new Error('Release synchronization must run in GitHub Actions.');
  const release = JSON.parse(exec('gh', ['api', `repos/${upstream}/releases/latest`]));
  if (!isNewRelease(release, state)) {
    summary(`No new stable upstream release. Latest: ${release.tag_name}; recorded: ${state.tag}. No sync or Windows build.`);
    return;
  }
  git(['check-ref-format', `refs/tags/${release.tag_name}`]);
  git(['fetch', '--no-tags', `https://github.com/${upstream}.git`, `refs/tags/${release.tag_name}`]);
  const sha = git(['rev-parse', 'FETCH_HEAD^{commit}']);
  checkI18n(root, state.reviewed_i18n_commit, sha);
  syncTree(root, sha);
  writeFileSync(resolve(root, stateFile), JSON.stringify({ ...state, release_id: release.id, tag: release.tag_name, release_commit: sha }, null, 2) + '\n');
  git(['config', 'user.name', 'github-actions[bot]']);
  git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  git(['add', '--all']);
  console.log(git(['commit', '-m', `Sync official MDHero ${release.tag_name} (${sha})`]));
  // Dispatch first so an API failure cannot mark an unbuilt release as handled.
  exec('gh', ['workflow', 'run', 'build-windows.yml', '--repo', repository, '--ref', 'main', '-f', `upstream_ref=${sha}`]);
  console.log(git(['push', 'origin', 'HEAD:main']));
  summary(`Synchronized official ${release.tag_name} (${sha}); preserved the reviewed Chinese file and dispatched the Windows build.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { summary(`## Stopped: review required\n\n${error.message}`); process.exitCode = 1; }
}
