// An action opened (presentation.md §explorer, "Opening": action).
import type { ThingOf } from '../../../../domain/reading.ts';
import { Band } from '../../../ui/Band.tsx';
import { Fold } from '../../../ui/Fold.tsx';
import { Line } from '../../../ui/opening/Line.tsx';
import { Ref } from '../../../ui/Ref.tsx';
import { Beyond, Tag } from '../../../ui/Tag.tsx';
import text from '../../../ui/text.module.css';
import { plural } from '../../../../domain/words.ts';
import { Checks } from '../parts/Checks.tsx';
import { Decisions, anyDecision } from '../parts/Decisions.tsx';
import { HeadCode, OnModel } from '../parts/OnModel.tsx';

export function ActionPanel({ action }: { action: ThingOf<'action'> }) {
  return (
    <>
      <Band cap="restated">
        <p className={text.statement}>{action.statement}</p>
        <p className={text.sub}>
          <Tag>{action.actor}</Tag> {action.guard ? `when: ${action.guard}` : 'no guard'}
          {action.beyond && (
            <>
              {' '}
              <Beyond />
            </>
          )}
        </p>
        {action.cases.length > 0 && <p className={text.sub}>cases: {action.cases.join(', ')}</p>}
      </Band>
      {action.models.length > 0 && (
        <Band cap="checked">
          {action.models.map((on) => (
            <OnModel
              key={on.model.id}
              head={
                <>
                  on <Ref to={on.model} /> <HeadCode>{on.operator}</HeadCode>
                </>
              }
            >
              <Checks checks={on.checks} />
            </OnModel>
          ))}
        </Band>
      )}
      <Band cap="defects planted">
        {action.faults.length > 0 ? (
          <ul className={text.plain}>
            {action.faults.map((fault) => (
              <Line key={fault.mechanism}>
                {fault.mechanism}
                <div className={text.sub}>
                  for <Ref to={fault.claim} />
                </div>
              </Line>
            ))}
          </ul>
        ) : (
          <span className={text.muted}>none</span>
        )}
      </Band>
      {action.scenarios.length > 0 && (
        <Band cap="used by">
          <Fold summary={plural(action.scenarios.length, 'scenario')}>
            <ul className={text.refs}>
              {action.scenarios.map((scenario) => (
                <Line key={scenario.id}>
                  <Ref to={scenario} />
                </Line>
              ))}
            </ul>
          </Fold>
        </Band>
      )}
      {anyDecision(action.decisions) && (
        <Band cap="decided">
          <Decisions decisions={action.decisions} />
        </Band>
      )}
    </>
  );
}
