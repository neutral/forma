// The title block, ruled into the sheet's corner (presentation.md §explorer, The top): the project, the
// standing, when the reading was computed, the build, the sheets and the revisions.
import type { ReactNode } from 'react';
import { Button } from 'react-aria-components';
import type { Standing, TitleBlock as Block } from '../../../domain/reading.ts';
import { cx } from '../../ui/cx.ts';
import { PageLink } from '../../ui/PageLink.tsx';
import { RevisionMark } from '../../ui/RevisionMark.tsx';
import text from '../../ui/text.module.css';
import { StandingSwitch } from './StandingSwitch.tsx';
import styles from './Top.module.css';

export interface TitleBlockProps {
  block: Block;
  standing: Standing;
  onSwitch(standing: Standing): void;
  /** A later reading is ready; it is offered here and read only when the reader asks. */
  later: boolean;
  onLater(): void;
}

export function TitleBlock({ block, standing, onSwitch, later, onLater }: TitleBlockProps) {
  return (
    <div className={styles.block}>
      <Cell cap="project" wide>
        {block.project}
      </Cell>
      <Cell cap="standing">
        <StandingSwitch standing={standing} onSwitch={onSwitch} />
      </Cell>
      <Cell cap="computed">
        {block.computedAt}
        {later && (
          <Button className={styles.later} onPress={onLater}>
            new reading ↻
          </Button>
        )}
      </Cell>
      {block.differs && (
        <Cell cap={block.differs.label} wide>
          {block.differs.says}
        </Cell>
      )}
      <Cell cap="build" wide>
        {block.build}
      </Cell>
      <Cell cap="sheets" wide>
        {block.sheets}
      </Cell>
      {block.revisions.length > 0 && (
        <Cell cap="revisions" wide>
          <table className={styles.revisions}>
            <tbody>
              {block.revisions.map((revision) => (
                <tr key={revision.number}>
                  <td>
                    <RevisionMark number={revision.number} />
                  </td>
                  <td>{revision.sectionId ? <PageLink to={revision.sectionId}>{revision.ref.label}</PageLink> : revision.ref.label}</td>
                  <td>{revision.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Cell>
      )}
    </div>
  );
}

function Cell({ cap, wide, children }: { cap: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cx(styles.cell, wide && styles.wide)}>
      <div className={cx(text.cap, styles.cellCap)}>{cap}</div>
      <div>{children}</div>
    </div>
  );
}
