// project.md §explore: the forma-explorer command, its refusals, its launch URL and its stopping.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, readFile, symlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { main } from '../../src/server/cli.ts';
import { app, builtPage, contents, get, project, scratch } from './fixtures.ts';

const CHECK = '(project.md §explore)';

async function occupiedPort(t: TestContext): Promise<number> {
  const occupied = createServer();
  await new Promise<void>((resolve) => occupied.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => occupied.close(resolve)));
  return (occupied.address() as AddressInfo).port;
}

async function run(args: string[], from: string) {
  let out = '';
  const status = await main(args, { from, write: (text) => (out += text) });
  return { status, out };
}

test('project.md §explore: the command refuses a malformed line, printing each reason, and leaves the project unchanged', async (t) => {
  const folder = await scratch(t);
  const root = await project(join(folder, 'project'));
  const before = await contents(root);
  const cases = [
    [],
    ['explore'],
    ['serve', '--port', '0'],
    ['serve', '--port', '65536'],
    ['serve', '--port', '-1'],
    ['serve', '--port', '1.5'],
    ['serve', '--port'],
    ['serve', '--port', '1234', '--port', '2345'],
    ['serve', '--unknown'],
    ['serve', 'extra'],
    ['export'],
    ['export', join(folder, 'a'), join(folder, 'b')],
    ['export', join(folder, 'export'), '--port', '1234'],
    ['serve', '--project', join(folder, 'missing')],
    ['export', '--project', join(root, 'design/brief/ticket.md'), join(folder, 'export')],
  ];
  for (const args of cases) {
    const { status, out } = await run(args.includes('--project') ? args : ['--project', root, ...args], folder);
    assert.equal(status, 1, `${args.join(' ')} is refused`);
    const lines = out.trimEnd().split('\n');
    assert.ok(lines.length > 0 && lines.every((line) => line.endsWith(CHECK) && line.length > CHECK.length + 1), out);
    assert.deepEqual(await contents(root), before);
  }
  assert.match((await run(['serve', '--project', 'missing'], folder)).out, /--project names .*missing, which is no folder/);
  assert.deepEqual(await contents(folder).then((files) => Object.keys(files)), ['project/design/brief/ticket.md'], 'nothing is exported');
});

test('project.md §explore: --project and the export folder are relative to the folder the command is run from', async (t) => {
  const folder = await scratch(t);
  await project(join(folder, 'project'));
  const port = await occupiedPort(t);
  const { status, out } = await run(['serve', '--project', 'project', '--port', String(port)], folder);
  assert.equal(status, 1);
  assert.doesNotMatch(out, /no folder/, 'the project is found from the folder the command is run from');
  assert.match(out, /already in use|not built/);
});

/** A copy of the app with a stub of its built page, run as `node src/server/cli.ts`. */
async function runtime(folder: string): Promise<string> {
  const copy = join(folder, 'explorer');
  await cp(join(app, 'src'), join(copy, 'src'), { recursive: true });
  await cp(join(app, 'package.json'), join(copy, 'package.json'));
  await symlink(join(app, 'node_modules'), join(copy, 'node_modules'), 'dir');
  await builtPage(join(copy, 'dist', 'client'));
  return join(copy, 'src', 'server', 'cli.ts');
}

async function deadline<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(message)), milliseconds)))]);
  } finally {
    clearTimeout(timer);
  }
}

async function setting(t: TestContext) {
  const folder = await scratch(t);
  await project(join(folder, 'project'));
  const tools = join(folder, 'toolchain');
  const home = join(folder, 'home');
  await mkdir(tools);
  await mkdir(home);
  const env = { ...process.env, INIT_CWD: folder, HOME: home, XDG_CACHE_HOME: join(home, '.cache'), LOCALAPPDATA: join(home, 'local'), FORMA_TOOLCHAIN: tools };
  return { folder, cli: await runtime(folder), env, elsewhere: home };
}

test('project.md §explore: the command prints its launch URL, and SIGINT or SIGTERM closes its server', async (t) => {
  const at = await setting(t);
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    const child = spawn(process.execPath, [at.cli, 'serve', '--project', 'project'], { cwd: at.elsewhere, env: at.env, stdio: ['ignore', 'pipe', 'pipe'] });
    t.after(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    });
    let stdout = '';
    let stderr = '';
    const launched = new Promise<string>((resolve, reject) => {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (text: string) => {
        stdout += text;
        const found = /^Forma explorer: (http:\/\/127\.0\.0\.1:\d+\/#token=[A-Za-z0-9_-]{43})$/m.exec(stdout);
        if (found?.[1]) resolve(found[1]);
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (text: string) => (stderr += text));
      child.once('error', reject);
      child.once('exit', (code) => reject(new Error(`The command exited before it listened (${code}): ${stdout}${stderr}`)));
    });
    const url = new URL(await deadline(launched, 15000, 'The command printed no launch URL.'));
    const door = { origin: url.origin, token: new URLSearchParams(url.hash.slice(1)).get('token') ?? '' };
    assert.equal((await get(door, '/', { auth: false })).status, 200);
    assert.equal((await get(door, '/api/status', { auth: false })).status, 401);
    assert.equal((await get(door, '/api/status')).status, 200);
    const ended = once(child, 'exit');
    child.kill(signal);
    const [code, killed] = await deadline(ended, 15000, `${signal} did not stop the command.`);
    assert.equal(code, 0, stderr);
    assert.equal(killed, null);
    await assert.rejects(get(door, '/'), /ECONNREFUSED|ECONNRESET|socket hang up/);
  }
});

test('project.md §explore: the command refuses a port in use, printing the reason', async (t) => {
  const at = await setting(t);
  const port = await occupiedPort(t);
  const refused = spawnSync(process.execPath, [at.cli, 'serve', '--project', 'project', '--port', String(port)], { cwd: at.elsewhere, env: at.env, encoding: 'utf8', timeout: 15000 });
  assert.equal(refused.status, 1, refused.stderr);
  assert.match(refused.stdout, /^Port \d+ is already in use; choose another port or omit --port\. \(project\.md §explore\)$/m);
});

test('project.md §explore: the command exports to a folder relative to where it is run from', async (t) => {
  const at = await setting(t);
  const exported = spawnSync(process.execPath, [at.cli, 'export', '--project', 'project', 'relative-export'], { cwd: at.elsewhere, env: at.env, encoding: 'utf8', timeout: 120000 });
  assert.equal(exported.status, 0, exported.stderr || exported.stdout);
  assert.equal(exported.stdout, `Exported ${join(at.folder, 'relative-export', 'index.html')}\n`);
  assert.ok((await readFile(join(at.folder, 'relative-export', 'index.html'), 'utf8')).includes('<script id="forma-snapshot" type="application/json">'));
});
