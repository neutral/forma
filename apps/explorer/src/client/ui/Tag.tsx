import type { ReactNode } from 'react';
import { cx } from './cx.ts';
import styles from './Tag.module.css';

/** A short label in a hairline box; red for what is not taken on. */
export function Tag({ tone = 'plain', children }: { tone?: 'plain' | 'diff'; children: ReactNode }) {
  return <span className={cx(styles.tag, tone === 'diff' && styles.diff)}>{children}</span>;
}

/** `beyond the text`: restated, but not said outright in the text it cites; the help says so. */
export const Beyond = () => <Tag>beyond the text</Tag>;

export const NotTakenOn = () => <Tag tone="diff">not taken on</Tag>;
