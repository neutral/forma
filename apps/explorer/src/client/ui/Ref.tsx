// A name that opens what it names, in place (presentation.md §explorer, Opening). The pressed name shows
// that it is open; pressing it again closes what it opened.
import { useContext, useId, useRef } from 'react';
import { Button } from 'react-aria-components';
import type { Ref as Named } from '../../domain/reading.ts';
import { cx } from './cx.ts';
import { Mark } from './Mark.tsx';
import { TargetContext } from './opening/targets.ts';
import { RevisionMark } from './RevisionMark.tsx';
import { Beyond, NotTakenOn } from './Tag.tsx';
import styles from './Ref.module.css';

export function Ref({ to }: { to: Named }) {
  const target = useContext(TargetContext);
  const opener = useId();
  const button = useRef<HTMLButtonElement>(null);
  if (!target) throw new Error(`${to.label} names a thing where nothing can open.`);
  const open = target.isOpen(opener);
  return (
    <>
      {to.revisions?.map((n) => <RevisionMark key={n} number={n} />)}
      <Button
        ref={button}
        className={cx(styles.ref, to.again && styles.again)}
        aria-expanded={open}
        onPress={() => target.toggle({ opener, id: to.id, returnTo: button.current })}
      >
        {to.mark && <Mark mark={to.mark} />}
        {to.label}
        {to.detail && <span className={styles.detail}> {to.detail}</span>}
      </Button>
      {to.beyond && (
        <>
          {' '}
          <Beyond />
        </>
      )}
      {to.untaken && (
        <>
          {' '}
          <NotTakenOn />
        </>
      )}
    </>
  );
}
