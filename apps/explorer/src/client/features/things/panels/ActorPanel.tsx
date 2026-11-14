// An actor or record opened (presentation.md §explorer, "Opening": actor or record).
import type { ThingOf } from '../../../../domain/reading.ts';
import { Band } from '../../../ui/Band.tsx';
import { Ref } from '../../../ui/Ref.tsx';
import { Beyond, Tag } from '../../../ui/Tag.tsx';
import text from '../../../ui/text.module.css';
import { Checks } from '../parts/Checks.tsx';
import { Decisions, anyDecision } from '../parts/Decisions.tsx';
import { OnModel } from '../parts/OnModel.tsx';

export function ActorPanel({ actor }: { actor: ThingOf<'actor'> }) {
  return (
    <>
      <Band cap="restated">
        <p className={text.statement}>{actor.names}</p>
        <p className={text.sub}>
          <Tag>{actor.rowKind}</Tag> <Tag>{actor.side}</Tag>
          {actor.seam && ` seam: ${actor.seam}`}
          {actor.isolation && ` · isolation: ${actor.isolation}`}
          {actor.beyond && (
            <>
              {' '}
              <Beyond />
            </>
          )}
        </p>
      </Band>
      {actor.models.length > 0 && (
        <Band cap="checked">
          {actor.models.map((on) => (
            <OnModel key={on.model.id} head={<>on <Ref to={on.model} /> · misbehaviours</>}>
              <Checks checks={on.checks} />
            </OnModel>
          ))}
        </Band>
      )}
      {anyDecision(actor.decisions) && (
        <Band cap="decided">
          <Decisions decisions={actor.decisions} />
        </Band>
      )}
    </>
  );
}
