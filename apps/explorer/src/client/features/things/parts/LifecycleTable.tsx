// A lifecycle as a table: what each action does in each phase.
import type { LifecycleTable as Table } from '../../../../domain/reading.ts';
import { cx } from '../../../ui/cx.ts';
import { Tag } from '../../../ui/Tag.tsx';
import text from '../../../ui/text.module.css';
import styles from './LifecycleTable.module.css';

type CellKind = Table['rows'][number]['cells'][number]['kind'];

const CELL: Record<CellKind, string | undefined> = {
  move: undefined,
  cases: styles.cases,
  refused: text.muted,
  unspecified: text.muted,
  open: text.diff,
};

export function LifecycleTable({ table }: { table: Table }) {
  return (
    <>
      <div className={styles.scroll}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th>{table.entity}</th>
              {table.actions.map((action) => (
                <th key={action}>{action}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.phase}>
                <th>
                  {row.phase}
                  {row.initial && (
                    <>
                      {' '}
                      <Tag>initial</Tag>
                    </>
                  )}
                  {row.end && (
                    <>
                      {' '}
                      <Tag>end</Tag>
                    </>
                  )}
                </th>
                {row.cells.map((cell, i) => (
                  <td key={i} className={CELL[cell.kind]}>
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.unaffected.length > 0 && <p className={cx(text.sub, text.muted)}>not affected by: {table.unaffected.join(', ')}</p>}
    </>
  );
}
