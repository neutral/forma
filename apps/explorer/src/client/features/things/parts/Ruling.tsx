// What the examination found, as ruled (presentation.md §explorer, "Opening": ruling): shown opened by itself,
// and inline wherever the thing it is on is opened.
import type { Added, ThingOf } from '../../../../domain/reading.ts';
import { useThing } from '../../../data/reading.tsx';
import { cx } from '../../../ui/cx.ts';
import { Fold } from '../../../ui/Fold.tsx';
import { RevisionMark } from '../../../ui/RevisionMark.tsx';
import text from '../../../ui/text.module.css';
import styles from './Ruling.module.css';

export function RulingBody({ ruling }: { ruling: ThingOf<'ruling'> }) {
  const words = ruling.words && (
    <>
      <div className={text.words}>{ruling.words.text}</div>
      <div className={cx(text.sub, text.muted)}>
        {ruling.words.by} · {ruling.words.at}
        {ruling.words.state && ` · ${ruling.words.state}`}
      </div>
    </>
  );
  return (
    <>
      <p className={text.lede}>
        {ruling.revision !== null && <RevisionMark number={ruling.revision} />}
        <b>{ruling.verdict}</b> · {ruling.level} · {ruling.says}
      </p>
      {ruling.surprises.length > 0 && (
        <ul className={text.plain}>
          {ruling.surprises.map((surprise) => (
            <li key={surprise.question} title={surprise.question}>
              expected <b>{surprise.expected}</b>, found <b>{surprise.found}</b>
            </li>
          ))}
        </ul>
      )}
      {words && (ruling.revision !== null ? words : <Fold summary="ruling, in words">{words}</Fold>)}
      {ruling.repairTo && <p className={text.sub}>repair → {ruling.repairTo}</p>}
      {ruling.added.map((added, i) => (
        <div key={i} className={styles.mechanism}>
          <div className={cx(text.cap, styles.mechanismCap)}>repair added</div>
          <div>
            {added.mechanism}
            <div className={text.sub}>
              <AgainstTheDocument added={added} />
            </div>
          </div>
        </div>
      ))}
      {ruling.shown && (
        <Fold summary="as shown at ruling">
          <pre className={text.pre}>{ruling.shown}</pre>
        </Fold>
      )}
    </>
  );
}

/** A repair's mechanism, placed against the developer's document. */
function AgainstTheDocument({ added }: { added: Added }) {
  if (added.brief === 'stated') return <>the document states it{added.words && `: ${added.words}`}</>;
  if (added.brief === 'absent') return <span className={text.diff}>not in the document</span>;
  return (
    <>
      not in the document, accepted
      {added.words && (
        <>
          <div className={text.words}>{added.words}</div>
          <div className={cx(text.sub, text.muted)}>
            {added.by} · {added.at}
          </div>
        </>
      )}
    </>
  );
}

/** The rulings on a thing, each in full, a revision's lined in red. */
export function Findings({ rulings }: { rulings: string[] }) {
  return rulings.map((id) => <Finding key={id} id={id} />);
}

function Finding({ id }: { id: string }) {
  const load = useThing(id);
  if (load.state === 'pending') return null;
  if (load.state === 'failed') return <p className={text.sub}>{load.message}</p>;
  const ruling = load.value;
  if (ruling.kind !== 'ruling') return null;
  return (
    <div className={cx(styles.finding, ruling.revision !== null && styles.real)}>
      <RulingBody ruling={ruling} />
    </div>
  );
}
