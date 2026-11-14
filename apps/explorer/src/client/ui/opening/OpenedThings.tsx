import { createContext, useContext, type ComponentType } from 'react';
import type { Opened, Openings } from './targets.ts';

export interface OpenedThingProps {
  opened: Opened;
  /** How it is brought into view: under a passage, from its start; under a line, as near as it is. */
  placement: 'start' | 'nearest';
  onClose(): void;
}

/** What draws an opened thing. The sheet supplies it, so the primitives that open things know no kind of thing. */
export const OpenedThingContext = createContext<ComponentType<OpenedThingProps> | null>(null);

export function OpenedThings({ openings, placement }: { openings: Openings; placement: OpenedThingProps['placement'] }) {
  const Thing = useContext(OpenedThingContext);
  if (!Thing) throw new Error('An opened thing is drawn only inside a sheet.');
  return openings.opened.map((opened) => (
    <Thing key={opened.opener} opened={opened} placement={placement} onClose={() => openings.target.close(opened.opener)} />
  ));
}
