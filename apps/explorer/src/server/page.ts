// The page the server serves and an export carries: the client as built into dist/client, as it is.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUILT = fileURLToPath(new URL('../../dist/client/', import.meta.url));
/** How the page is built in Forma's checkout; an installed package carries it built. */
export const BUILD = 'pnpm build';

export interface Page {
  html: string;
  script: string;
  style: string;
}

/** The built page in `folder`; it refuses, naming the command that builds it, when any file is missing. */
export async function readPage(folder: string): Promise<Page> {
  const read = (name: string) => readFile(join(folder, name), 'utf8');
  try {
    const [html, script, style] = await Promise.all([read('index.html'), read('explorer.js'), read('explorer.css')]);
    return { html, script, style };
  } catch {
    throw new Error(`The explorer's page is not built: ${folder} lacks index.html, explorer.js or explorer.css. In Forma's checkout, build it with ${BUILD}; an installed package carries it, so install it again.`);
  }
}
