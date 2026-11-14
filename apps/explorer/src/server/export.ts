// `forma-explorer export` (project.md §explore, "Export"): one self-contained index.html, in a new or
// empty folder outside the project, holding the built page's script and style and a snapshot of both
// standings' readings. The client reads a snapshot when the page holds `#forma-snapshot`.
import { access, constants, mkdir, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { clockAhead } from '@forma/cli/graph';
import { compute as inWorker, type Compute } from './compute.ts';
import { messageOf } from './message.ts';
import { snapshotDocument } from './document.ts';
import { BUILT, readPage } from './page.ts';
import { canonical, inside } from './paths.ts';

interface ExportOptions {
  project: string;
  destination: string;
  /** The built page's folder. */
  page?: string;
  compute?: Compute;
}


async function clockAllows(project: string) {
  const ahead = await clockAhead(project);
  if (ahead)
    throw new Error(
      `The clock rule holds (door.md §clock): ${ahead.file} holds the time ${ahead.at}, ahead of this machine's clock, so forma-explorer export writes nothing until the clock passes it.`,
    );
}

/** The nearest folder of `path` that exists, `path` itself included. */
async function existing(path: string): Promise<string> {
  let at = path;
  while (!(await stat(at).catch(() => null)) && dirname(at) !== at) at = dirname(at);
  return at;
}

async function write(folder: string, html: string): Promise<string> {
  const file = join(folder, 'index.html');
  let made: string | undefined;
  try {
    made = await mkdir(folder, { recursive: true });
    await writeFile(file, html, { flag: 'wx' });
    return file;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') await rm(made ?? file, { recursive: true, force: true });
    throw new Error(`Cannot write the export: ${messageOf(error)}`);
  }
}

/** Writes the export and gives the path of its index.html. */
export async function exportReading({ project, destination, page = BUILT, compute = inWorker }: ExportOptions): Promise<string> {
  const root = await realpath(project);
  const folder = await canonical(destination);
  if (inside(root, folder)) throw new Error('Export to a new or empty folder outside the project.');
  const present = await stat(folder).catch(() => null);
  if (present && (!present.isDirectory() || (await readdir(folder)).length > 0))
    throw new Error('The export folder must be new or empty; no file is overwritten.');
  const parent = await existing(folder);
  await access(parent, constants.W_OK).catch(() => {
    throw new Error(`Cannot write the export: ${parent} is not writable.`);
  });
  const built = await readPage(page);
  await clockAllows(root);
  const found = await compute(root, [], {});
  if (found.kind !== 'computed') throw new Error('The computation named a kept generation where none was kept.');
  await clockAllows(root);
  const html = snapshotDocument(built, found.snapshot);
  for (const path of new Set([root, resolve(project)]))
    if (html.includes(path)) throw new Error(`The export would hold the project's machine path (${path}); nothing is written.`);
  return write(folder, html);
}
