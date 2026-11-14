// A lifecycle opened (presentation.md §explorer, "Opening": lifecycle).
import type { ThingOf } from '../../../../domain/reading.ts';
import { LifecycleDrawing } from '../../../lifecycle/LifecycleDrawing.tsx';
import { Band } from '../../../ui/Band.tsx';
import { Fold } from '../../../ui/Fold.tsx';
import { Line } from '../../../ui/opening/Line.tsx';
import { Ref } from '../../../ui/Ref.tsx';
import { Beyond } from '../../../ui/Tag.tsx';
import text from '../../../ui/text.module.css';
import { plural } from '../../../../domain/words.ts';
import { Decisions, anyDecision } from '../parts/Decisions.tsx';
import { LifecycleTable } from '../parts/LifecycleTable.tsx';

export function LifecyclePanel({ lifecycle }: { lifecycle: ThingOf<'lifecycle'> }) {
  return (
    <>
      <Band cap="restated">
        <LifecycleDrawing drawing={lifecycle.drawing} />
        <Fold summary="table">
          <LifecycleTable table={lifecycle.table} />
        </Fold>
        {lifecycle.beyond && <Beyond />}
      </Band>
      {lifecycle.expressions.length > 0 && (
        <Band cap="modelled">
          <ul className={text.plain}>
            {lifecycle.expressions.map((on) => (
              <Line key={on.model.id}>
                on <Ref to={on.model} />: <span className={text.mono}>{on.expression}</span>
              </Line>
            ))}
          </ul>
        </Band>
      )}
      {lifecycle.scenarios.length > 0 && (
        <Band cap="walked by">
          <Fold summary={plural(lifecycle.scenarios.length, 'scenario')}>
            <ul className={text.refs}>
              {lifecycle.scenarios.map((scenario) => (
                <Line key={scenario.id}>
                  <Ref to={scenario} />
                </Line>
              ))}
            </ul>
          </Fold>
        </Band>
      )}
      {anyDecision(lifecycle.decisions) && (
        <Band cap="decided">
          <Decisions decisions={lifecycle.decisions} />
        </Band>
      )}
    </>
  );
}
