// A passage on the sheet: what the developer wrote, the margin rule ticked where it starts, its notes, and
// under it the one thing its notes have opened.
import type { Section } from '../../../domain/reading.ts';
import { OpenedThings } from '../../ui/opening/OpenedThings.tsx';
import { TargetContext, useOpenings } from '../../ui/opening/targets.ts';
import { cx } from '../../ui/cx.ts';
import text from '../../ui/text.module.css';
import { Notes } from '../notes/Notes.tsx';
import { Prose } from './Prose.tsx';
import styles from './Passage.module.css';

export function Passage({ section }: { section: Section }) {
  const openings = useOpenings(true);
  return (
    <section className={styles.passage} id={section.id}>
      <Prose html={section.html} />
      <aside className={cx(text.forma, styles.notes)}>
        <TargetContext value={openings.target}>
          <Notes notes={section.notes} />
        </TargetContext>
      </aside>
      <div className={styles.opened}>
        <OpenedThings openings={openings} placement="start" />
      </div>
    </section>
  );
}
