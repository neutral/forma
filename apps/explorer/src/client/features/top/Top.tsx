// The top of the sheet (presentation.md §explorer, The top): the project's name, the numbered general
// notes, links to each document and list, and the title block in the corner.
import { Fragment } from 'react';
import type { Sheet } from '../../../domain/reading.ts';
import { cx } from '../../ui/cx.ts';
import { PageLink } from '../../ui/PageLink.tsx';
import text from '../../ui/text.module.css';
import { LISTS } from '../lists/Lists.tsx';
import { TitleBlock, type TitleBlockProps } from './TitleBlock.tsx';
import styles from './Top.module.css';

export function Top({ sheet, ...block }: { sheet: Sheet } & Omit<TitleBlockProps, 'block'>) {
  return (
    <header className={cx(text.forma, styles.top)}>
      <div className={styles.lead}>
        <h1 className={styles.project}>{sheet.title.project}</h1>
        <div className={cx(text.cap, styles.notesCap)}>notes</div>
        <ol className={styles.general}>
          {sheet.general.map((runs, i) => (
            <li key={i}>
              {runs.map((run, j) => (
                <Fragment key={j}>{run.tone === 'revision' ? <span className={text.diff}>{run.text}</span> : run.text}</Fragment>
              ))}
            </li>
          ))}
        </ol>
        <nav className={styles.toc} aria-label="contents">
          {sheet.documents.map((document) => {
            const first = document.sections[0];
            return first ? (
              <PageLink key={document.number} to={first.id}>
                {document.number} {document.name}
              </PageLink>
            ) : null;
          })}
          <span className={styles.separator} />
          {LISTS.map((list) => (
            <PageLink key={list.id} to={list.id}>
              {list.id}
            </PageLink>
          ))}
        </nav>
      </div>
      <TitleBlock block={sheet.title} {...block} />
    </header>
  );
}
