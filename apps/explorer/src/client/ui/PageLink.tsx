import type { ReactNode } from 'react';
import styles from './PageLink.module.css';

/** A link to a place on the page. It moves there and leaves the address as it is (see app/inPageLinks.ts). */
export function PageLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a className={styles.link} href={`#${to}`}>
      {children}
    </a>
  );
}
