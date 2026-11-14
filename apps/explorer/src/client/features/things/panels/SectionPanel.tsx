// A passage's restatement opened (presentation.md §explorer, "Opening": passage's restatement). A thing met
// above is grey; each with `Origin` `added` says `beyond the text`.
import type { Ref as Named, ThingOf } from '../../../../domain/reading.ts';
import { LifecycleDrawing } from '../../../lifecycle/LifecycleDrawing.tsx';
import { Band } from '../../../ui/Band.tsx';
import { cx } from '../../../ui/cx.ts';
import { Fold } from '../../../ui/Fold.tsx';
import { Line } from '../../../ui/opening/Line.tsx';
import { Ref } from '../../../ui/Ref.tsx';
import text from '../../../ui/text.module.css';
import { LifecycleTable } from '../parts/LifecycleTable.tsx';

export function SectionPanel({ section }: { section: ThingOf<'section'> }) {
  return (
    <>
      {section.happens.length > 0 && (
        <Band cap="happens">
          <Names refs={section.happens} sentences />
        </Band>
      )}
      {section.states.length > 0 && (
        <Band cap="states">
          {section.states.map((state) => (
            <div key={state.ref.id}>
              <Line as="p">
                <Ref to={state.ref} />
              </Line>
              <LifecycleDrawing drawing={state.drawing} />
              <Fold summary="table">
                <LifecycleTable table={state.table} />
              </Fold>
            </div>
          ))}
        </Band>
      )}
      {section.should.length > 0 && (
        <Band cap="should happen">
          <Names refs={section.should} />
        </Band>
      )}
      {section.mustNot.length > 0 && (
        <Band cap="must not">
          <Names refs={section.mustNot} />
        </Band>
      )}
      {section.actors.length > 0 && (
        <Band cap="actors, records">
          <ul className={text.refs}>
            {section.actors.map((actor) => (
              <Line key={actor.ref.id}>
                <Ref to={actor.ref} />{' '}
                <span className={text.muted}>
                  {actor.side} {actor.rowKind}
                </span>
              </Line>
            ))}
          </ul>
        </Band>
      )}
    </>
  );
}

function Names({ refs, sentences }: { refs: Named[]; sentences?: boolean }) {
  return (
    <ul className={cx(text.refs, sentences && text.sentences)}>
      {refs.map((named) => (
        <Line key={named.id}>
          <Ref to={named} />
        </Line>
      ))}
    </ul>
  );
}
