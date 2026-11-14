// What the server reads from Forma (`@forma/cli/graph`, plain JavaScript). The graph comes back
// unknown: it is checked against `Graph` (src/domain/graph.ts) before anything reads it.
declare module '@forma/cli/graph' {
  export interface Fingerprint {
    hash: string;
    inputs: { path: string; sha256: string }[];
    versions: Record<string, unknown>;
  }
  /** door.md §clock: the latest tracked time ahead of this machine's clock, or null. */
  export interface ClockAhead {
    at: string;
    file: string;
  }
  export function fingerprint(root: string): Promise<Fingerprint>;
  export function buildGraph(root: string): Promise<unknown>;
  export function clockAhead(root: string): Promise<ClockAhead | null>;
  /** The user's cache folder on this operating system, where the toolchain and the read index are kept. */
  export function cacheBase(platform?: NodeJS.Platform, env?: NodeJS.ProcessEnv, home?: string): string;
}
