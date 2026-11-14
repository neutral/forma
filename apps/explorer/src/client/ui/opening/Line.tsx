import type { ReactNode } from 'react';
import { OpenedThings } from './OpenedThings.tsx';
import { TargetContext, useOpenings } from './targets.ts';

/**
 * A line inside an opened thing that may name things. What a name on it opens stands under it:
 * inside a list item, after any other line.
 */
export function Line({ as = 'li', className, children }: { as?: 'li' | 'div' | 'p'; className?: string; children: ReactNode }) {
  const openings = useOpenings(false);
  const names = <TargetContext value={openings.target}>{children}</TargetContext>;
  const things = <OpenedThings openings={openings} placement="nearest" />;
  if (as === 'li')
    return (
      <li className={className}>
        {names}
        {things}
      </li>
    );
  const Tag = as;
  return (
    <>
      <Tag className={className}>{names}</Tag>
      {things}
    </>
  );
}
