// An opened thing (presentation.md §explorer, Opening): its kind, its name and the passages it cites, then
// what its kind shows. It closes by itself, by `Escape` when opened last, or by the name that opened it.
// A claim not established has a dashed line down its left; a revision's line is red.
import { useEffect, useRef } from 'react';
import { Button } from 'react-aria-components';
import type { Thing } from '../../../domain/reading.ts';
import { useThing } from '../../data/reading.tsx';
import { cx } from '../../ui/cx.ts';
import { Mark, STANDING } from '../../ui/Mark.tsx';
import { scrollBehavior } from '../../ui/motion.ts';
import { OpenedThings, type OpenedThingProps } from '../../ui/opening/OpenedThings.tsx';
import { useStackEntry } from '../../ui/opening/stack.tsx';
import { TargetContext, useOpenings } from '../../ui/opening/targets.ts';
import text from '../../ui/text.module.css';
import { ActionPanel } from './panels/ActionPanel.tsx';
import { ActorPanel } from './panels/ActorPanel.tsx';
import { AssumptionPanel } from './panels/AssumptionPanel.tsx';
import { ClaimPanel } from './panels/ClaimPanel.tsx';
import { LifecyclePanel } from './panels/LifecyclePanel.tsx';
import { ModelPanel } from './panels/ModelPanel.tsx';
import { QuestionPanel } from './panels/QuestionPanel.tsx';
import { RulingPanel } from './panels/RulingPanel.tsx';
import { ScenarioPanel } from './panels/ScenarioPanel.tsx';
import { SectionPanel } from './panels/SectionPanel.tsx';
import { Where } from './Where.tsx';
import styles from './Thing.module.css';

export function OpenedThing({ opened, placement, onClose }: OpenedThingProps) {
  const load = useThing(opened.id);
  const frame = useRef<HTMLElement>(null);
  // A name inside that stands on no line of its own opens at the thing's end.
  const inside = useOpenings(false);
  const close = () => {
    onClose();
    opened.returnTo?.focus();
  };
  useStackEntry(close);
  const shown = load.state !== 'pending';
  useEffect(() => {
    if (shown) frame.current?.scrollIntoView({ block: placement, behavior: scrollBehavior() });
  }, [shown, placement]);

  if (load.state === 'pending') return null;
  const thing = load.state === 'ready' ? load.value : null;
  return (
    <article ref={frame} className={cx(text.forma, styles.thing, thing && lineOf(thing))}>
      <header className={styles.header}>
        <span className={text.cap}>{thing?.kindLabel}</span>
        <h4 className={styles.title}>
          {thing ? thing.title : load.state === 'failed' && load.message}
          {thing?.kind === 'ruling' && thing.detail && <span className={text.muted}> {thing.detail}</span>}
        </h4>
        {thing?.kind === 'claim' && (
          <span className={styles.standing}>
            <Mark mark={thing.standing} />
            {STANDING[thing.standing].says}
          </span>
        )}
        <Button className={styles.close} onPress={close}>
          close
        </Button>
      </header>
      {thing && (
        <>
          <Where from={thing.from} />
          <TargetContext value={inside.target}>
            <Panel thing={thing} />
          </TargetContext>
          <OpenedThings openings={inside} placement="nearest" />
        </>
      )}
    </article>
  );
}

function lineOf(thing: Thing): string | undefined {
  if (thing.kind === 'claim') return thing.standing === 'not' ? styles.pending : undefined;
  if (thing.kind === 'ruling') return thing.revision !== null ? styles.revision : styles.quiet;
  if (thing.kind === 'section' || thing.kind === 'model') return styles.quiet;
  return undefined;
}

function Panel({ thing }: { thing: Thing }) {
  switch (thing.kind) {
    case 'claim':
      return <ClaimPanel claim={thing} />;
    case 'scenario':
      return <ScenarioPanel scenario={thing} />;
    case 'action':
      return <ActionPanel action={thing} />;
    case 'lifecycle':
      return <LifecyclePanel lifecycle={thing} />;
    case 'question':
      return <QuestionPanel question={thing} />;
    case 'assumption':
      return <AssumptionPanel assumption={thing} />;
    case 'actor':
      return <ActorPanel actor={thing} />;
    case 'ruling':
      return <RulingPanel ruling={thing} />;
    case 'model':
      return <ModelPanel model={thing} />;
    case 'section':
      return <SectionPanel section={thing} />;
  }
}
