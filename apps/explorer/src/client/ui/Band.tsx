import type { ReactNode } from 'react';
import text from './text.module.css';
import styles from './Band.module.css';

/** One band of an opened thing: its label at left, what it holds at right, a hairline above. */
export function Band({ cap, children }: { cap: string; children: ReactNode }) {
  return (
    <div className={styles.band}>
      <div className={`${text.cap} ${styles.cap}`}>{cap}</div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
