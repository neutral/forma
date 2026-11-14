// A document's title: its number in a circle, its name, its path, and a rule drawn out to the sheet's border.
import type { Document } from '../../../domain/reading.ts';
import { cx } from '../../ui/cx.ts';
import text from '../../ui/text.module.css';
import styles from './DocumentTitle.module.css';

export function DocumentTitle({ document }: { document: Document }) {
  return (
    <div className={cx(text.forma, styles.title)}>
      <span className={styles.number}>{document.number}</span>
      <span className={styles.name}>{document.name}</span>
      <span className={styles.path}>{document.path}</span>
    </div>
  );
}
