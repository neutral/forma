// Rulings and where each is met, and the revisions: presentation.md §explorer, "Notes" and "Revisions".
import type { GraphNode, NodeOf } from '../graph.ts';
import { push, uniq, type Access } from './access.ts';
import type { Passage, ReadingOrder } from './document.ts';

export type Ruling = NodeOf<'decision'>;
/** What a ruling's surprises' questions serve: an entry or a boundary row. */
type Served = Extract<GraphNode, { kind: 'entry' | 'boundary' }>;

export type Rulings = {
  all: Ruling[];
  /** The revision number of each ruling that found a fault in the design, in reading order. */
  number: Map<string, number>;
  /** The rulings on each entry or boundary row, by its id. */
  on: Map<string, Ruling[]>;
  /** The rulings first met at each passage, by its id. */
  at: Map<string, Ruling[]>;
  /** The passage where each ruling is met. */
  home: Map<string, Passage>;
  served: Map<string, Served[]>;
  /** The mechanisms each ruling's repair added, by the ruling's name. */
  mechanisms: Map<string, NodeOf<'mechanism'>[]>;
};

export const verdictOf = (r: Ruling): string => r.data.rows.Verdict ?? '';
export const isReal = (r: Ruling): boolean => verdictOf(r) === 'real finding';

export function rulings(g: Access, order: ReadingOrder): Rulings {
  const all = g.byKind('decision').filter((d) => d.data.kind === 'rule');
  const mechanisms = new Map<string, NodeOf<'mechanism'>[]>();
  for (const m of g.byKind('mechanism')) push(mechanisms, m.data.ruling, m);
  const served = new Map(all.map((r) => [r.id, servedBy(g, r)]));
  const on = new Map<string, Ruling[]>();
  const at = new Map<string, Ruling[]>();
  const home = new Map<string, Passage>();
  const position = (address: string | undefined) => (address === undefined ? undefined : order.position.get(address));
  for (const r of all) {
    const things = served.get(r.id) ?? [];
    for (const s of things) push(on, s.id, r);
    // A ruling is met at the first passage cited by an entry one of its surprises' questions serves.
    const first = uniq(things.flatMap((s) => s.data.cites ?? []))
      .filter((a) => order.position.has(a))
      .sort((a, b) => (position(a) ?? 0) - (position(b) ?? 0))[0];
    const passage = first === undefined ? undefined : order.byAddress.get(first);
    if (passage) {
      push(at, passage.id, r);
      home.set(r.id, passage);
    }
  }
  // Numbered from 1 in reading order of where each is met, then by time.
  const far = Number.MAX_SAFE_INTEGER;
  const number = new Map(
    all
      .filter(isReal)
      .sort(
        (a, b) =>
          (position(home.get(a.id)?.data.address) ?? far) - (position(home.get(b.id)?.data.address) ?? far) ||
          String(a.data.at).localeCompare(String(b.data.at)),
      )
      .map((r, i) => [r.id, i + 1]),
  );
  return { all, number, on, at, home, served, mechanisms };
}

function servedBy(g: Access, r: Ruling): Served[] {
  const keys = uniq(
    (r.data.surprises?.surprises ?? []).flatMap((s) => {
      const serves = g.find('question', s.question)?.data.serves;
      return serves ? [serves] : [];
    }),
  );
  return keys.flatMap((k) => {
    const n = g.find('entry', k) ?? g.find('boundary', k);
    return n ? [n] : [];
  });
}
