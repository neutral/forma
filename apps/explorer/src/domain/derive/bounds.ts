import type { NodeOf } from '../graph.ts';

/** A model's bounds as its rows write them, constants only: `Tickets {"t"} · Keys {"a", "b"}`. */
export const compactBounds = (model: NodeOf<'model'>): string =>
  (model.data.model.bounds ?? [])
    .filter((b) => /^constant /.test(b.bound))
    .map((b) => `${b.bound.replace(/^constant /, '')} ${b.value}`)
    .join(' · ');
