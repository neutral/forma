// The marks (presentation.md §explorer, Marks). Standing is told by mark and word, never by colour alone.
import type { ReactNode } from 'react';
import type { Mark as Standing } from '../../domain/reading.ts';
import { LABEL } from '../../domain/words.ts';
import { cx } from './cx.ts';
import styles from './Mark.module.css';

/** Each standing's mark and its word. */
export const STANDING: Record<Standing, { glyph: string; says: string }> = {
  established: { glyph: '●', says: LABEL.established },
  accepted: { glyph: '◐', says: LABEL.acceptedUnexamined },
  not: { glyph: '○', says: LABEL.notEstablished },
};

/** A claim's standing mark. */
export function Mark({ mark }: { mark: Standing }) {
  const { glyph, says } = STANDING[mark];
  return (
    <i className={cx(styles.g, mark === 'not' && styles.not)} role="img" aria-label={says} title={says}>
      {glyph}
    </i>
  );
}

/** Any other mark: a check's, a condition's, an engine's. Its line says the same in words. */
export function Glyph({ tone, children }: { tone: 'plain' | 'quiet'; children: ReactNode }) {
  return (
    <i className={cx(styles.g, tone === 'quiet' && styles.not)} aria-hidden="true">
      {children}
    </i>
  );
}
