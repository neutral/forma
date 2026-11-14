// One arrow for a pair of phases, labelled with the actions that move between them, one to a line: those
// the walk takes in red, numbered by step, and the one that must be refused dashed and saying so.
import { useId } from 'react';
import type { Edge, EdgeProps } from '@xyflow/react';
import { cx } from '../ui/cx.ts';
import { LABEL_LINE, type Route } from './geometry.ts';
import { isLit, litLabel, type Action } from './lighting.ts';
import styles from './Drawing.module.css';

type MoveData = { route: Route; actions: Action[] };
export type MoveEdgeType = Edge<MoveData, 'move'>;

export function MoveEdge({ data }: EdgeProps<MoveEdgeType>) {
  const head = `head${useId().replace(/[^\w-]/g, '')}`;
  if (!data) return null;
  const { route, actions } = data;
  const on = actions.some(isLit);
  const refused = actions.some((a) => a.mustNot);
  return (
    <g>
      <defs>
        <marker
          id={head}
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth={on ? 9 : 8}
          markerHeight={on ? 9 : 8}
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 z" className={cx(styles.head, on && styles.headOn)} />
        </marker>
      </defs>
      <path className={cx(styles.edge, on && styles.edgeOn, refused && styles.edgeRefused)} d={route.path} markerEnd={`url(#${head})`} />
      <text className={styles.label} x={route.label.x} y={route.label.y} textAnchor={route.label.anchor}>
        {actions.map((action, i) => (
          <tspan key={action.label} x={route.label.x} dy={i === 0 ? 0 : LABEL_LINE} className={isLit(action) ? styles.lit : undefined}>
            {isLit(action) ? litLabel(action) : action.label}
          </tspan>
        ))}
      </text>
    </g>
  );
}
