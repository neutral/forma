// An assumption opened (presentation.md §explorer, "Opening": assumption). One taken on is said to be taken
// on; it is never ticked.
import type { ThingOf } from '../../../../domain/reading.ts';
import { Band } from '../../../ui/Band.tsx';
import { Fold } from '../../../ui/Fold.tsx';
import { Line } from '../../../ui/opening/Line.tsx';
import { Ref } from '../../../ui/Ref.tsx';
import { Tag } from '../../../ui/Tag.tsx';
import text from '../../../ui/text.module.css';
import { plural } from '../../../../domain/words.ts';
import { DecisionList } from '../parts/Decisions.tsx';

export function AssumptionPanel({ assumption }: { assumption: ThingOf<'assumption'> }) {
  const { taken, earlier } = assumption;
  return (
    <>
      <Band cap="restated">
        <p className={text.statement}>{assumption.statement}</p>
        <p className={text.sub}>
          {assumption.premiseClass && (
            <>
              <Tag>{assumption.premiseClass}</Tag>{' '}
            </>
          )}
          {assumption.why}
        </p>
      </Band>
      {assumption.falsifier && <Band cap="falsified by">{assumption.falsifier}</Band>}
      {assumption.provider && <Band cap="answered by">{assumption.provider}</Band>}
      <Band cap="taken on">
        {taken ? (
          <>
            {taken.by} · {taken.at}
            {taken.words && <div className={text.words}>{taken.words}</div>}
            {earlier.length > 0 && (
              <Fold summary={plural(earlier.length, 'earlier decision')}>
                <DecisionList decisions={earlier} words={false} />
              </Fold>
            )}
          </>
        ) : (
          <span className={text.diff}>not taken on</span>
        )}
      </Band>
      <Band cap="holds up">
        {assumption.holds.length > 0 ? (
          <ul className={text.refs}>
            {assumption.holds.map((claim) => (
              <Line key={claim.id}>
                <Ref to={claim} />
              </Line>
            ))}
          </ul>
        ) : (
          <span className={text.muted}>no claim</span>
        )}
      </Band>
    </>
  );
}
