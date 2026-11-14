// The decisions on a thing: those in force, and the earlier ones behind a fold.
import type { Decision, Decisions as DecisionsOn } from '../../../../domain/reading.ts';
import { cx } from '../../../ui/cx.ts';
import { Fold } from '../../../ui/Fold.tsx';
import text from '../../../ui/text.module.css';
import { plural } from '../../../../domain/words.ts';
import styles from './Decisions.module.css';

export const anyDecision = (decisions: DecisionsOn): boolean => decisions.now.length + decisions.earlier.length > 0;

export function Decisions({ decisions }: { decisions: DecisionsOn }) {
  return (
    <>
      {decisions.now.length > 0 && <DecisionList decisions={decisions.now} />}
      {decisions.earlier.length > 0 && (
        <Fold summary={plural(decisions.earlier.length, 'earlier decision')}>
          <DecisionList decisions={decisions.earlier} />
        </Fold>
      )}
    </>
  );
}

export function DecisionList({ decisions, words = true }: { decisions: Decision[]; words?: boolean }) {
  return (
    <ul className={styles.decisions}>
      {decisions.map((decision, i) => (
        <li key={i} className={cx(decision.state && styles.old)}>
          <b>
            {decision.kind}
            {decision.choice && ` ${decision.choice}`}
          </b>
          {` · ${decision.by} · ${decision.at}`}
          {decision.state && (
            <>
              {' · '}
              <i>{decision.state}</i>
            </>
          )}
          {words && decision.words && <div className={text.words}>{decision.words}</div>}
        </li>
      ))}
    </ul>
  );
}
