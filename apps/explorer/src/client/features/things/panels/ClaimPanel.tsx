// A claim opened (presentation.md §explorer, "Opening": claim). No `✓` stands beside it or its conditions:
// a condition in place is named, and an assumption taken on is said to be taken on.
import type { ClaimModel, ThingOf } from '../../../../domain/reading.ts';
import { Band } from '../../../ui/Band.tsx';
import { cx } from '../../../ui/cx.ts';
import { Fold } from '../../../ui/Fold.tsx';
import { Mark } from '../../../ui/Mark.tsx';
import { Line } from '../../../ui/opening/Line.tsx';
import { Ref } from '../../../ui/Ref.tsx';
import { Beyond, Tag } from '../../../ui/Tag.tsx';
import text from '../../../ui/text.module.css';
import { list, plural } from '../../../../domain/words.ts';
import { CheckLikeList, Checks } from '../parts/Checks.tsx';
import { Decisions, anyDecision } from '../parts/Decisions.tsx';
import { HeadNote, OnModel } from '../parts/OnModel.tsx';
import { Findings } from '../parts/Ruling.tsx';
import { Waits } from '../parts/Waits.tsx';

const PHASES_ONLY = 'phases only';

export function ClaimPanel({ claim }: { claim: ThingOf<'claim'> }) {
  return (
    <>
      <Band cap="restated">
        <p className={text.statement}>{claim.statement}</p>
        <p className={text.sub}>
          <Tag>{claim.claimKind}</Tag> at stake: {claim.stake}
          {claim.beyond && (
            <>
              {' '}
              <Beyond />
            </>
          )}
        </p>
      </Band>
      <Band cap="checked">
        <p>
          <b>{claim.standingLine}</b>
        </p>
        {claim.acceptance && (
          <p>
            {claim.acceptance.words}{' '}
            <span className={text.muted}>
              {claim.acceptance.by} · {claim.acceptance.at}
            </span>
          </p>
        )}
        {claim.models.map((on) => (
          <ClaimOnModel key={on.model.id} on={on} />
        ))}
      </Band>
      {claim.rulings.length > 0 && (
        <Band cap="found">
          <Findings rulings={claim.rulings} />
        </Band>
      )}
      {anyDecision(claim.decisions) && (
        <Band cap="decided">
          <Decisions decisions={claim.decisions} />
        </Band>
      )}
    </>
  );
}

function ClaimOnModel({ on }: { on: ClaimModel }) {
  const phasesOnly = on.bounds === PHASES_ONLY;
  const head = (
    <>
      <Mark mark={on.established ? 'established' : 'not'} />
      on <Ref to={on.model} /> <HeadNote>{phasesOnly ? PHASES_ONLY : 'within bounds'}</HeadNote>
    </>
  );
  return (
    <OnModel head={head}>
      {!phasesOnly && on.bounds && <div className={cx(text.sub, text.mono)}>{on.bounds}</div>}
      {on.cannotExpress !== null ? (
        <CheckLikeList lines={[{ key: 'cannot', glyph: '×', body: `cannot express: ${on.cannotExpress}` }]} />
      ) : (
        <>
          {on.established ? (
            <Fold summary="seven conditions hold">
              <ul className={text.plain}>
                {on.inPlace.map((condition) => (
                  <li key={condition}>{condition}</li>
                ))}
              </ul>
            </Fold>
          ) : (
            on.inPlace.length > 0 && <div className={text.sub}>in place: {list(on.inPlace)}</div>
          )}
          {on.notYet.length > 0 && (
            <CheckLikeList
              lines={on.notYet.map((group) => ({
                key: group.conditions.join(),
                glyph: '○',
                body: (
                  <>
                    not yet: {list(group.conditions)}
                    {group.waits && group.waits.length > 0 && (
                      <>
                        {' · waits on '}
                        <Waits waits={group.waits} />
                      </>
                    )}
                    {group.reason && ` · ${group.reason}`}
                  </>
                ),
              }))}
            />
          )}
          {on.encoding && (
            <Fold summary="in the model's language">
              <pre className={text.pre}>{on.encoding}</pre>
            </Fold>
          )}
          <Checks checks={on.checks} />
          {on.premises.refs.length > 0 && (
            <Fold
              summary={`${plural(on.premises.refs.length, 'assumption')} · ${on.premises.allTaken ? 'all taken on' : 'not all taken on'}`}
            >
              <ul className={text.refs}>
                {on.premises.refs.map((premise) => (
                  <Line key={premise.id}>
                    <Ref to={premise} />
                  </Line>
                ))}
              </ul>
            </Fold>
          )}
        </>
      )}
    </OnModel>
  );
}

