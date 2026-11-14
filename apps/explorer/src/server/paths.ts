// Where a path really is, for the rules that keep the explorer's writes outside the project.
import { lstat, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** Whether `child` is `parent` or within it. */
export function inside(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === '' || (path.split(sep)[0] !== '..' && !isAbsolute(path));
}

const exists = (path: string) => lstat(path).then(() => true, () => false);

/**
 * `path` with every symbolic link resolved, through its nearest existing ancestor; the part that does
 * not exist yet is appended as written. A broken link is not a part that does not exist: it throws.
 */
export async function canonical(path: string): Promise<string> {
  const missing: string[] = [];
  let at = resolve(path);
  for (;;) {
    try {
      return join(await realpath(at), ...missing);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || dirname(at) === at) throw error;
      if (await exists(at)) throw new Error(`${at} is a symbolic link to a path that does not exist.`);
      missing.unshift(basename(at));
      at = dirname(at);
    }
  }
}
