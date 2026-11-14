// A scenario's steps, the refused one marked, and where it is expected to end.
import type { Step } from '../../../../domain/reading.ts';
import { Line } from '../../../ui/opening/Line.tsx';
import { Ref } from '../../../ui/Ref.tsx';
import { Tag } from '../../../ui/Tag.tsx';
import text from '../../../ui/text.module.css';
import styles from './Steps.module.css';

/** `current`: the step a player stands at, when the reader steps through the walk. */
export function Steps({ steps, expectedEnd, current }: { steps: Step[]; expectedEnd: string | null; current?: number }) {
  return (
    <>
      <ol className={styles.steps}>
        {steps.map((step) => (
          <Line key={step.n} className={step.n === current ? styles.current : undefined}>
            {typeof step.action === 'string' ? step.action : <Ref to={step.action} />}
            {step.case && (
              <>
                {' '}
                <Tag>{step.case}</Tag>
              </>
            )}{' '}
            <span className={text.muted}>{step.arguments}</span>
            {step.refused && (
              <>
                {' '}
                <b>must be refused</b>
              </>
            )}
          </Line>
        ))}
      </ol>
      {expectedEnd && <p className={text.sub}>ends: {expectedEnd}</p>}
    </>
  );
}
