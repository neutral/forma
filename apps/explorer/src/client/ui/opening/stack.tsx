// `Escape` closes the thing opened last (presentation.md §explorer, Use): every opened thing joins this
// stack while it stands, in the order opened.
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

interface Entry {
  close(): void;
}
interface Stack {
  join(entry: Entry): () => void;
  /** Closes the thing opened last; false when none is open. */
  closeLast(): boolean;
}

const StackContext = createContext<Stack | null>(null);

export function OpenStack({ children }: { children: ReactNode }) {
  const entries = useRef<Entry[]>([]);
  const stack = useMemo<Stack>(
    () => ({
      join(entry) {
        entries.current.push(entry);
        return () => {
          entries.current = entries.current.filter((e) => e !== entry);
        };
      },
      closeLast() {
        const last = entries.current.at(-1);
        last?.close();
        return Boolean(last);
      },
    }),
    [],
  );
  return <StackContext value={stack}>{children}</StackContext>;
}

export function useOpenStack(): Stack {
  const stack = useContext(StackContext);
  if (!stack) throw new Error('The open stack is set up by the app.');
  return stack;
}

/** Joins the stack while the caller stands, closing by `close`. */
export function useStackEntry(close: () => void): void {
  const stack = useOpenStack();
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => stack.join({ close: () => latest.current() }), [stack]);
}
