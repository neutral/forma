// A phase drawn: its box, marked if initial or an end, red once the walk reaches it; under it, the actions
// that leave it where it is (`stays`) and the cells a choice still poses (`left open`).
import { Fragment } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { cx } from '../ui/cx.ts';
import { isLit, litLabel, type Action } from './lighting.ts';
import styles from './Drawing.module.css';

type PhaseData = {
  phase: string;
  initial: boolean;
  end: boolean;
  reached: boolean;
  stays: Action[];
  open: string[];
};
export type PhaseNodeType = Node<PhaseData, 'phase'>;

export function PhaseNode({ data, width }: NodeProps<PhaseNodeType>) {
  return (
    <div className={styles.phase} style={{ width }}>
      {/* The moves are drawn from the layout; these handles only anchor them for React Flow. */}
      <Handle type="target" position={Position.Left} className={styles.handle} isConnectable={false} />
      {data.initial && <span className={styles.start} />}
      <div className={cx(styles.box, data.reached && styles.reached, data.end && styles.end)}>{data.phase}</div>
      {data.stays.length > 0 && (
        <div className={styles.under}>
          stays:{' '}
          {data.stays.map((action, i) => (
            <Fragment key={action.label}>
              {i > 0 && ', '}
              {isLit(action) ? <span className={styles.lit}>{litLabel(action)}</span> : action.label}
            </Fragment>
          ))}
        </div>
      )}
      {data.open.map((action) => (
        <div key={action} className={cx(styles.under, styles.open)}>
          left open: {action}
        </div>
      ))}
      <Handle type="source" position={Position.Right} className={styles.handle} isConnectable={false} />
    </div>
  );
}
