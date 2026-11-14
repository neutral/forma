// The reading as one drawing sheet (presentation.md §explorer): the top, the developer's documents in
// reading order with their notes, and the four lists at the end.
import { Fragment } from 'react';
import type { Sheet } from '../../../domain/reading.ts';
import { OpenedThingContext } from '../../ui/opening/OpenedThings.tsx';
import { DocumentTitle } from '../document/DocumentTitle.tsx';
import { ListsAtTheEnd } from '../lists/Lists.tsx';
import { Passage } from '../section/Passage.tsx';
import { OpenedThing } from '../things/OpenedThing.tsx';
import type { TitleBlockProps } from '../top/TitleBlock.tsx';
import { Top } from '../top/Top.tsx';
import styles from './SheetView.module.css';

export function SheetView({ sheet, ...block }: { sheet: Sheet } & Omit<TitleBlockProps, 'block'>) {
  return (
    <OpenedThingContext value={OpenedThing}>
      <main className={styles.sheet} data-standing={sheet.standing} data-generation={sheet.generation}>
        <Top sheet={sheet} {...block} />
        {sheet.documents.map((document) => (
          <Fragment key={document.number}>
            <DocumentTitle document={document} />
            {document.sections.map((section) => (
              <Passage key={section.id} section={section} />
            ))}
          </Fragment>
        ))}
        <ListsAtTheEnd lists={sheet.lists} />
      </main>
    </OpenedThingContext>
  );
}
