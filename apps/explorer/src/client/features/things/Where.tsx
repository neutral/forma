import { Fragment } from 'react';
import type { PassageLink } from '../../../domain/reading.ts';
import { PageLink } from '../../ui/PageLink.tsx';
import styles from './Thing.module.css';

/** The passages an opened thing cites, each a link; `not from the document` where none is on the page; nothing where it cites none. */
export function Where({ from }: { from: PassageLink[] | null }) {
  if (from === null) return <p className={styles.where}>not from the document</p>;
  if (from.length === 0) return null;
  return (
    <p className={styles.where}>
      from{' '}
      {from.map((passage, i) => (
        <Fragment key={passage.sectionId}>
          {i > 0 && ' · '}
          <PageLink to={passage.sectionId}>{passage.heading}</PageLink>
        </Fragment>
      ))}
    </p>
  );
}
