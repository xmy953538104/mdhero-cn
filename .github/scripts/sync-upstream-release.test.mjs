import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { changedDictionaries, checkI18n, isNewRelease, ownedPaths, syncTree } from './sync-upstream-release.mjs';

const en = 'src/lib/i18n/locales/en.json';
const zh = 'src/lib/i18n/locales/zh-CN.json';
const dictionaries = { [en]: { open: 'Open', save: 'Save {name}' }, [zh]: { open: '打开', save: '保存 {name}' } };

test('only newer stable releases trigger work', () => {
  const state = { release_id: 10 };
  assert.equal(isNewRelease({ id: 10 }, state), false);
  assert.equal(isNewRelease({ id: 9 }, state), false);
  assert.equal(isNewRelease({ id: 11, draft: true }, state), false);
  assert.equal(isNewRelease({ id: 11, prerelease: true }, state), false);
  assert.equal(isNewRelease({ id: 11 }, state), true);
  assert.throws(() => isNewRelease({ id: '11' }, state), /Invalid release ID/);
});

test('JSON key order and formatting do not request translation review', () => {
  const reordered = { ...dictionaries, [en]: JSON.parse('{ "save": "Save {name}", "open": "Open" }') };
  assert.deepEqual(changedDictionaries(dictionaries, reordered), []);
});

test('English meaning changes, added keys, Chinese edits and placeholder changes request review', () => {
  for (const value of [{ open: 'Browse', save: 'Save {name}' }, { ...dictionaries[en], close: 'Close' }, { open: 'Open', save: 'Save {path}' }]) {
    assert.deepEqual(changedDictionaries(dictionaries, { ...dictionaries, [en]: value }), [en]);
  }
  assert.deepEqual(changedDictionaries(dictionaries, { ...dictionaries, [zh]: { ...dictionaries[zh], open: '浏览' } }), [zh]);
});

test('sync takes the upstream source tree, preserves owned files and removes upstream workflows', () => {
  const fixtureParent = resolve(process.cwd(), '..', 'validation');
  mkdirSync(fixtureParent, { recursive: true });
  const repo = mkdtempSync(join(fixtureParent, 'release-sync-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  const write = (path, value) => { mkdirSync(dirname(join(repo, path)), { recursive: true }); writeFileSync(join(repo, path), value); };
  try {
    git('init', '-q');
    git('config', 'user.name', 'fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    git('config', 'core.autocrlf', 'false');
    write(en, JSON.stringify(dictionaries[en]));
    write(zh, JSON.stringify(dictionaries[zh]));
    write('app.txt', 'upstream application');
    write('.github/workflows/official.yml', 'upstream workflow');
    git('add', '.'); git('commit', '-qm', 'official release');
    const upstreamSha = git('rev-parse', 'HEAD');
    write('app.txt', 'old fork application');
    write('old-only.txt', 'must disappear after sync');
    git('rm', '.github/workflows/official.yml');
    for (const path of ownedPaths) write(path === '.github/workflows' ? `${path}/build-windows.yml` : path, path === zh ? JSON.stringify({ ...dictionaries[zh], open: '打开文件' }) : 'owned');
    git('add', '.'); git('commit', '-qm', 'community files');
    assert.doesNotThrow(() => checkI18n(repo, upstreamSha, upstreamSha));
    assert.throws(() => checkI18n(repo, upstreamSha, git('rev-parse', 'HEAD')), /Language dictionary content changed/);
    const ownChinese = readFileSync(join(repo, zh), 'utf8');
    syncTree(repo, upstreamSha);
    assert.equal(readFileSync(join(repo, 'app.txt'), 'utf8'), 'upstream application');
    assert.equal(readFileSync(join(repo, zh), 'utf8'), ownChinese);
    assert.equal(readFileSync(join(repo, '.github/workflows/build-windows.yml'), 'utf8'), 'owned');
    assert.equal(git('ls-files', 'old-only.txt', '.github/workflows/official.yml'), '');
    for (const path of ownedPaths.filter((path) => path !== '.github/workflows' && path !== zh)) assert.equal(readFileSync(join(repo, path), 'utf8'), 'owned');
  } finally {
    if (dirname(repo) !== fixtureParent || !repo.startsWith(join(fixtureParent, 'release-sync-'))) throw new Error('Unsafe fixture cleanup path.');
    rmSync(repo, { recursive: true, force: true });
  }
});
