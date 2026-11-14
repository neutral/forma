// Where a name opens what it names (presentation.md §explorer, Opening). From a passage's notes or a list
// at the end: under that passage or list, one at a time. From inside an opened thing: under the line that names it.
import { createContext, useMemo, useState } from 'react';

/** A thing opened in place, and the name that opened it. */
export interface Opened {
  /** The name that opened it; pressing that name again closes it. */
  opener: string;
  id: string;
  /** Where focus goes back to when it closes. */
  returnTo: HTMLElement | null;
}

interface Target {
  isOpen(opener: string): boolean;
  toggle(opened: Opened): void;
  close(opener: string): void;
}

export const TargetContext = createContext<Target | null>(null);

export interface Openings {
  opened: Opened[];
  target: Target;
}

/** The things open in one place: one at a time under a passage or a list, any number under a line. */
export function useOpenings(oneAtATime: boolean): Openings {
  const [opened, setOpened] = useState<Opened[]>([]);
  const target = useMemo<Target>(
    () => ({
      isOpen: (opener) => opened.some((o) => o.opener === opener),
      toggle: (next) =>
        setOpened((now) =>
          now.some((o) => o.opener === next.opener)
            ? now.filter((o) => o.opener !== next.opener)
            : oneAtATime
              ? [next]
              : [...now, next],
        ),
      close: (opener) => setOpened((now) => now.filter((o) => o.opener !== opener)),
    }),
    [opened, oneAtATime],
  );
  return { opened, target };
}
