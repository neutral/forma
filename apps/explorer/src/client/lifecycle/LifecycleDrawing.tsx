// A lifecycle drawn (presentation.md §explorer, A lifecycle drawn), from the lifecycle as read and the walk
// the lifecycle tool gave; the page runs no machine. Read-only: nothing drags, connects, zooms or pans, and
// the page scrolls through it. It is fitted to the width it has.
import '@xyflow/react/dist/base.css';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ReactFlow, type ReactFlowInstance } from '@xyflow/react';
import type { LifecycleDrawing as Drawing } from '../../domain/reading.ts';
import { useLoad } from '../data/load.ts';
import { geometry, moveKey } from './geometry.ts';
import { layoutKey, layoutLifecycle, type Layout } from './layout.ts';
import { actionUpTo, reached, refusedBy } from './lighting.ts';
import { MoveEdge, type MoveEdgeType } from './MoveEdge.tsx';
import { PhaseNode, type PhaseNodeType } from './PhaseNode.tsx';
import styles from './Drawing.module.css';

const nodeTypes = { phase: PhaseNode };
const edgeTypes = { move: MoveEdge };

/** `upTo`: the step a reader stands at while stepping the walk; null shows the walk as given. */
export function LifecycleDrawing({ drawing, upTo = null }: { drawing: Drawing; upTo?: number | null }) {
  const layout = useLoad(layoutKey(drawing), () => layoutLifecycle(drawing));
  if (layout.state === 'pending') return null;
  if (layout.state === 'failed') return <p className={styles.refused}>{layout.message}</p>;
  return <Drawn drawing={drawing} layout={layout.value} upTo={upTo} />;
}

function Drawn({ drawing, layout, upTo }: { drawing: Drawing; layout: Layout; upTo: number | null }) {
  const id = useId();
  const frame = useRef<HTMLDivElement>(null);
  const [flow, setFlow] = useState<ReactFlowInstance<PhaseNodeType, MoveEdgeType> | null>(null);
  const shape = useMemo(() => geometry(drawing, layout), [drawing, layout]);

  const nodes = useMemo<PhaseNodeType[]>(
    () =>
      drawing.phases.flatMap((phase) => {
        const box = layout.boxes.get(phase.id);
        if (!box) return [];
        return [
          {
            id: phase.id,
            type: 'phase',
            position: { x: box.x, y: box.y },
            width: box.width,
            height: box.height,
            data: {
              phase: phase.id,
              initial: phase.initial,
              end: phase.end,
              reached: reached(drawing, phase, upTo),
              stays: drawing.stays.filter((s) => s.phase === phase.id).flatMap((s) => s.actions.map((a) => actionUpTo(a, upTo))),
              open: drawing.open.filter((o) => o.phase === phase.id).map((o) => o.action),
            },
          },
        ];
      }),
    [drawing, layout, upTo],
  );

  const edges = useMemo<MoveEdgeType[]>(
    () =>
      drawing.moves.flatMap((move) => {
        const route = shape.routes.get(moveKey(move));
        if (!route) return [];
        return [
          {
            id: moveKey(move),
            source: move.from,
            target: move.to,
            type: 'move',
            data: { route, actions: move.actions.map((a) => actionUpTo(a, upTo)) },
          },
        ];
      }),
    [drawing, shape, upTo],
  );

  useEffect(() => {
    const element = frame.current;
    if (!flow || !element) return;
    const fit = () => void flow.fitBounds({ x: 0, y: 0, width: shape.width, height: shape.height }, { padding: 0 });
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [flow, shape]);

  const refused = refusedBy(drawing, upTo);
  return (
    <>
      <div
        ref={frame}
        className={styles.frame}
        style={{ aspectRatio: `${shape.width} / ${shape.height}`, maxWidth: shape.width }}
        role="img"
        aria-label={drawing.name}
      >
        <ReactFlow
          id={id}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={setFlow}
          minZoom={0.1}
          maxZoom={1}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          disableKeyboardA11y
          proOptions={{ hideAttribution: true }}
        />
      </div>
      {refused !== null && <p className={styles.refused}>step {refused} is refused here</p>}
    </>
  );
}
