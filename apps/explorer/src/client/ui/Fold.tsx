import type { ReactNode } from 'react';
import { Button, Disclosure, DisclosurePanel } from 'react-aria-components';
import { cx } from './cx.ts';
import styles from './Fold.module.css';

/** What a thing holds behind a fold: closed until the reader opens it. */
export function Fold({ summary, small, children }: { summary: ReactNode; small?: boolean; children: ReactNode }) {
  return (
    <Disclosure className={styles.fold}>
      <Button slot="trigger" className={cx(styles.summary, small && styles.small)}>
        {summary}
      </Button>
      <DisclosurePanel>{children}</DisclosurePanel>
    </Disclosure>
  );
}
