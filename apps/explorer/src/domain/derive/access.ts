// One mode of the graph, indexed: nodes by id and kind, and edges in and out by relation
// (account.md §explorer-graph: reverse lookup reverses edges and creates no semantic edge).
import type { EntryData, EntryOf, GraphEdge, GraphNode, Mode, NodeKind, NodeOf, Relation } from '../graph.ts';

export type Access = {
  node(id: string): GraphNode | undefined;
  /** The node of a kind and key, by the graph's identifier rule: kind, a colon and the percent-encoded key. */
  find<K extends NodeKind>(kind: K, key: string): NodeOf<K> | undefined;
  entry<K extends EntryData['kind']>(kind: K, key: string): EntryOf<K> | undefined;
  byKind<K extends NodeKind>(kind: K): NodeOf<K>[];
  entries<K extends EntryData['kind']>(kind: K): EntryOf<K>[];
  /** The targets of a node's edges of one relation. */
  outOf(id: string, relation: Relation): GraphNode[];
  /** The sources of the edges of one relation into a node. */
  into(id: string, relation: Relation): GraphNode[];
};

export const nodeId = (kind: NodeKind, key: string): string => `${kind}:${encodeURIComponent(key)}`;

export const isEntry = <K extends EntryData['kind']>(n: GraphNode | undefined, kind: K): n is EntryOf<K> =>
  n?.kind === 'entry' && n.data.kind === kind;

export function access(mode: Mode): Access {
  const nodes = new Map(mode.nodes.map((n) => [n.id, n]));
  const kinds = new Map<NodeKind, GraphNode[]>();
  for (const n of mode.nodes) push(kinds, n.kind, n);
  const out = new Map<string, GraphEdge[]>();
  const inn = new Map<string, GraphEdge[]>();
  for (const e of mode.edges) {
    push(out, e.source, e);
    push(inn, e.target, e);
  }
  const ends = (edges: GraphEdge[] | undefined, relation: Relation, end: 'source' | 'target') =>
    (edges ?? []).flatMap((e) => {
      const n = e.relation === relation ? nodes.get(e[end]) : undefined;
      return n ? [n] : [];
    });
  const byKind = <K extends NodeKind>(kind: K) => (kinds.get(kind) ?? []) as NodeOf<K>[];
  const ofKind = <K extends NodeKind>(n: GraphNode | undefined, kind: K) => (n?.kind === kind ? (n as NodeOf<K>) : undefined);
  return {
    node: (id) => nodes.get(id),
    find: (kind, key) => ofKind(nodes.get(nodeId(kind, key)), kind),
    entry: (kind, key) => {
      const n = nodes.get(nodeId('entry', key));
      return isEntry(n, kind) ? n : undefined;
    },
    byKind,
    entries: (kind) => byKind('entry').filter((n) => isEntry(n, kind)) as EntryOf<typeof kind>[],
    outOf: (id, relation) => ends(out.get(id), relation, 'target'),
    into: (id, relation) => ends(inn.get(id), relation, 'source'),
  };
}

export function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
