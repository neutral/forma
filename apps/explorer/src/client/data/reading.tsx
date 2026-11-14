// The hooks the page reads through: the source, the sheet of a standing, the things its names open,
// and whether a later reading is ready.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Sheet, Standing, Thing } from '../../domain/reading.ts';
import { useLoad, type Load } from './load.ts';
import { NotKept, type ReadingSource } from './source.ts';

const STATUS_EVERY_MS = 4000;

const SourceContext = createContext<ReadingSource | null>(null);

export function SourceProvider({ source, children }: { source: ReadingSource; children: ReactNode }) {
  return <SourceContext value={source}>{children}</SourceContext>;
}

function useSource(): ReadingSource {
  const source = useContext(SourceContext);
  if (!source) throw new Error('The page reads only through a source.');
  return source;
}

/**
 * The sheet of a standing. `round` counts the times the reader asked for a later reading. While the next
 * sheet loads, the one being read stays.
 */
export function useSheet(standing: Standing, round: number): { sheet: Sheet | null; failure: string | null } {
  const source = useSource();
  const load = useLoad(`${standing}:${round}`, () => source.sheet(standing));
  const [last, setLast] = useState<Sheet | null>(null);
  if (load.state === 'ready' && load.value !== last) setLast(load.value);
  return { sheet: load.state === 'ready' ? load.value : last, failure: load.state === 'failed' ? load.message : null };
}

/** Whether a reading later than the one shown is ready. It is offered, never swapped in. */
export function useLaterReading(shown: string): boolean {
  const source = useSource();
  const [latest, setLatest] = useState<string | null>(null);
  useEffect(() => {
    const ask = () =>
      source.status().then(
        (status) => setLatest(status.generation),
        () => undefined, // the next tick asks again
      );
    const timer = setInterval(ask, STATUS_EVERY_MS);
    return () => clearInterval(timer);
  }, [source]);
  return latest !== null && latest !== shown;
}

interface Shown {
  key: string;
  thing(id: string): Promise<Thing>;
}

const ShownContext = createContext<Shown | null>(null);

/**
 * The reading being read: each thing its names open is fetched once, from the generation of its sheet.
 * `onNotKept` hears that the server keeps that generation no longer.
 */
export function ShownReading({
  standing,
  generation,
  onNotKept,
  children,
}: {
  standing: Standing;
  generation: string;
  onNotKept(): void;
  children: ReactNode;
}) {
  const source = useSource();
  const notKept = useRef(onNotKept);
  useEffect(() => {
    notKept.current = onNotKept;
  });
  const shown = useMemo<Shown>(() => {
    const things = new Map<string, Promise<Thing>>();
    return {
      key: `${standing}:${generation}`,
      thing(id) {
        const known = things.get(id);
        if (known) return known;
        const loading = source.thing(standing, generation, id);
        loading.catch((error: unknown) => {
          if (error instanceof NotKept) notKept.current();
        });
        things.set(id, loading);
        return loading;
      },
    };
  }, [source, standing, generation]);
  return <ShownContext value={shown}>{children}</ShownContext>;
}

export function useThing(id: string): Load<Thing> {
  const shown = useContext(ShownContext);
  if (!shown) throw new Error('A thing opens only within a reading.');
  return useLoad(`${shown.key}:${id}`, () => shown.thing(id));
}
