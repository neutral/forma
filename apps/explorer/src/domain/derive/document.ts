// The documents, in reading order (presentation.md §explorer, "The document"): each passage as written,
// under its document's numbered title, with the notes first met there.
import type { NodeOf } from '../graph.ts';
import { linkedDocuments, passageHtml } from '../markdown.ts';
import type { Document, PassageLink } from '../reading.ts';
import type { Access } from './access.ts';
import type { Context } from './context.ts';
import { notesOf } from './notes.ts';

export type Passage = NodeOf<'passage'>;

export type ReadingOrder = {
  /** The brief's documents, in reading order. */
  files: string[];
  passages: Passage[];
  /** Each passage's place in reading order, by address. */
  position: Map<string, number>;
  byAddress: Map<string, Passage>;
  /** The passage where each entry, boundary row or part is first met, by the thing's id. */
  firstMet: Map<string, Passage>;
};

const FIRST = /(^|\/)(overview|readme|index)\.md$/i;

export function readingOrder(g: Access): ReadingOrder {
  // Supplied sources are not shown; a document's front matter is no part of its text (design.md §brief).
  const shown = g.byKind('passage').filter((p) => !p.data.source);
  const all = [...new Set(shown.map((p) => p.data.path))];
  const first = all.find((f) => FIRST.test(f)) ?? all[0];
  const ofFile = (f: string) => shown.filter((p) => p.data.path === f);
  const linked =
    first === undefined
      ? []
      : linkedDocuments(ofFile(first).map((p) => p.data.text).join('\n'), first).filter((f) => f !== first && all.includes(f));
  const files = first === undefined ? [] : [first, ...linked, ...all.filter((f) => f !== first && !linked.includes(f))];
  const passages = files.flatMap(ofFile);
  const firstMet = new Map<string, Passage>();
  for (const p of passages) for (const id of p.data.citations) if (!firstMet.has(id)) firstMet.set(id, p);
  return {
    files,
    passages,
    position: new Map(passages.map((p, i) => [p.data.address, i])),
    byAddress: new Map(passages.map((p) => [p.data.address, p])),
    firstMet,
  };
}

export const sectionId = (p: Passage): string => `p-${encodeURIComponent(p.data.address)}`;

export const heading = (p: Passage): string => p.data.heading || basename(p.data.path);

/** A document's name: its file's name without `.md`. */
const documentName = (path: string): string => basename(path).replace(/\.md$/, '');

const basename = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

export const passageLink = (p: Passage): PassageLink => ({ sectionId: sectionId(p), heading: heading(p) });

/** The passages a thing cites, each a link; null when it is not from the document. */
export function passageLinks(ctx: Context, cites: readonly string[] | null | undefined): PassageLink[] | null {
  const links = (cites ?? []).flatMap((a) => {
    const p = ctx.order.byAddress.get(a);
    return p ? [passageLink(p)] : [];
  });
  return links.length ? links : null;
}

export function documents(ctx: Context): Document[] {
  const { order } = ctx;
  // A link to another document of the brief moves to that passage on the page, or else to the document's first.
  const landing = (file: string, fragment: string | null) => {
    const p = (fragment ? order.byAddress.get(`${file}${fragment}`) : undefined) ?? order.passages.find((x) => x.data.path === file);
    return p ? sectionId(p) : null;
  };
  return order.files.map((path, i) => ({
    number: i + 1,
    name: documentName(path),
    path,
    sections: order.passages
      .filter((p) => p.data.path === path)
      .map((p) => ({
        id: sectionId(p),
        address: p.data.address,
        heading: heading(p),
        html: passageHtml(p.data.text, p.data.path, landing),
        notes: notesOf(ctx, p),
      })),
  }));
}
