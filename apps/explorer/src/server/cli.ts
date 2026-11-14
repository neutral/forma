#!/usr/bin/env node
// `forma-explorer` (project.md §explore): serves a project's reading, or exports it to one file. It
// exits 0 when it did what was asked, and 1 when it refused, printing every reason. The project and the
// export folder are relative to the folder the command is run from: pnpm's INIT_CWD when pnpm runs it.
import { realpathSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLine } from './args.ts';
import { exportReading } from './export.ts';
import { messageOf } from './message.ts';
import { serve } from './serve.ts';

const CHECK = 'project.md §explore';

interface Io {
  /** The folder the command is run from. */
  from: string;
  write(text: string): void;
}

const isFolder = (path: string) => stat(path).then((found) => found.isDirectory(), () => false);

/** Resolves on the first SIGINT or SIGTERM. */
const stopped = () =>
  new Promise<void>((resolve) => {
    const stop = () => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      resolve();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  });

export async function main(args: readonly string[], { from, write }: Io): Promise<number> {
  const refuse = (reasons: string[]) => {
    write(reasons.map((says) => `${says} (${CHECK})\n`).join(''));
    return 1;
  };
  const line = parseLine(args);
  if ('refused' in line) return refuse(line.refused);
  const project = resolve(from, line.project ?? '.');
  if (!(await isFolder(project)))
    return refuse([`--project names ${project}, which is no folder: name the project folder, or run forma-explorer inside it`]);
  try {
    if (line.command === 'export') {
      write(`Exported ${await exportReading({ project, destination: resolve(from, line.destination) })}\n`);
      return 0;
    }
    const serving = await serve({ project, port: line.port, onListen: (url) => write(`Forma explorer: ${url}\n`) });
    await stopped();
    await serving.close();
    return 0;
  } catch (error) {
    return refuse([messageOf(error)]);
  }
}

/** Whether this file is the program being run, as `node src/server/cli.ts` or through the `forma-explorer` link. */
function isEntry(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntry())
  process.exitCode = await main(process.argv.slice(2), {
    from: process.env.INIT_CWD ?? process.cwd(),
    write: (text) => process.stdout.write(text),
  });
