// A scenario opened (presentation.md §explorer, "Opening": scenario), its walk drawn on each lifecycle it moves
// and stepped by the reader.
import type { ThingOf } from '../../../../domain/reading.ts';
import { LifecycleDrawing } from '../../../lifecycle/LifecycleDrawing.tsx';
import { Player, useWalk } from '../../../player/Player.tsx';
import { Band } from '../../../ui/Band.tsx';
import { Ref } from '../../../ui/Ref.tsx';
import { Beyond } from '../../../ui/Tag.tsx';
import text from '../../../ui/text.module.css';
import { Checks } from '../parts/Checks.tsx';
import { Decisions, anyDecision } from '../parts/Decisions.tsx';
import { OnModel } from '../parts/OnModel.tsx';
import { Findings } from '../parts/Ruling.tsx';
import { Steps } from '../parts/Steps.tsx';

type Scenario = ThingOf<'scenario'>;

export function ScenarioPanel({ scenario }: { scenario: Scenario }) {
  return (
    <>
      <Band cap="restated">
        <p>
          <b>{scenario.polarity === 'must not' ? 'Must not happen' : 'Should happen'}</b>
          {scenario.beyond && (
            <>
              {' '}
              <Beyond />
            </>
          )}
        </p>
        <ScenarioWalk scenario={scenario} />
      </Band>
      {scenario.models.length > 0 && (
        <Band cap="checked">
          {scenario.models.map((on) => (
            <OnModel key={on.model.id} head={<>on <Ref to={on.model} /></>}>
              <Checks checks={on.checks} />
            </OnModel>
          ))}
        </Band>
      )}
      {scenario.rulings.length > 0 && (
        <Band cap="found">
          <Findings rulings={scenario.rulings} />
        </Band>
      )}
      {anyDecision(scenario.decisions) && (
        <Band cap="decided">
          <Decisions decisions={scenario.decisions} />
        </Band>
      )}
    </>
  );
}

function ScenarioWalk({ scenario }: { scenario: Scenario }) {
  const walk = useWalk(Math.max(0, ...scenario.steps.map((s) => s.n)));
  const lit = scenario.drawings.some((d) => d.lit);
  const stepping = lit && walk.at < walk.last;
  return (
    <>
      <Steps steps={scenario.steps} expectedEnd={scenario.expectedEnd} current={stepping ? walk.at : undefined} />
      {scenario.walk && <p className={text.sub}>lifecycle, phases only, no standing: {scenario.walk}</p>}
      {scenario.drawings.map((drawing) => (
        <LifecycleDrawing key={drawing.id} drawing={drawing} upTo={drawing.lit ? walk.at : null} />
      ))}
      {lit && <Player walk={walk} />}
    </>
  );
}
