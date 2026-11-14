// The page an export writes (project.md §explore, "Export"): the built page with its script and style
// inlined, a Content-Security-Policy pinned to that script, and both standings' readings inside it.
import { createHash } from 'node:crypto';
import type { Snapshot } from '../domain/reading.ts';
import { BUILD, type Page } from './page.ts';

const SCRIPT = /<script\b[^>]*\bsrc="[^"]*explorer\.js"[^>]*><\/script>/;
const STYLE = /<link\b[^>]*\bhref="[^"]*explorer\.css"[^>]*>/;
const HEAD = /<head\b[^>]*>/;

/** Script text that ends only at its own closing tag: no `</script` and no comment opener that changes how HTML reads it. */
const inlineScript = (code: string) =>
  code
    .replace(/\r\n?/g, '\n')
    .replace(/<\/(script)/gi, '<\\/$1')
    .replaceAll('<!--', '<\\!--');
const inlineStyle = (css: string) => css.replace(/<\/(style)/gi, '<\\/$1');
/** JSON that HTML cannot end early and every JavaScript engine reads as written. */
const inlineJson = (value: unknown) =>
  JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');

/** The export's own policy: no request, and no script but the page's own. */
const policyFor = (script: string) =>
  [
    "default-src 'none'",
    `script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'`,
    "style-src 'unsafe-inline'",
    'img-src data:',
    'font-src data:',
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

/** The built page with its script, its style and the snapshot inside it. */
export function snapshotDocument(page: Page, snapshot: Snapshot): string {
  if (!SCRIPT.test(page.html) || !STYLE.test(page.html) || !HEAD.test(page.html) || !page.html.includes('</body>'))
    throw new Error(`The built page does not load explorer.js and explorer.css as the build writes them; in Forma's checkout, build it again with ${BUILD}.`);
  const script = inlineScript(page.script);
  return page.html
    .replace(HEAD, (head) => `${head}<meta http-equiv="Content-Security-Policy" content="${policyFor(script)}">`)
    .replace(STYLE, () => `<style>${inlineStyle(page.style)}</style>`)
    .replace(SCRIPT, () => `<script type="module">${script}</script>`)
    .replace('</body>', () => `<script id="forma-snapshot" type="application/json">${inlineJson(snapshot)}</script>\n</body>`);
}
