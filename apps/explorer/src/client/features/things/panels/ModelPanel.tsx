// A model opened (presentation.md §explorer, "Opening": model).
import type { ThingOf } from '../../../../domain/reading.ts';
import { Band } from '../../../ui/Band.tsx';
import { Line } from '../../../ui/opening/Line.tsx';
import { Ref } from '../../../ui/Ref.tsx';
import text from '../../../ui/text.module.css';
import { Waits } from '../parts/Waits.tsx';
import styles from './ModelPanel.module.css';

export function ModelPanel({ model }: { model: ThingOf<'model'> }) {
  return (
    <>
      <Band cap="covers">
        {model.parts.join(', ')}
        {model.name && ` · ${model.name}`}
        <div className={text.sub}>{model.engine}</div>
      </Band>
      {model.bounds === null ? (
        <Band cap="bounds">
          <p>phases only; guards unevaluated</p>
        </Band>
      ) : (
        model.bounds.length > 0 && (
          <Band cap="bounds">
            <table className={styles.bounds}>
              <tbody>
                {model.bounds.map((row) => (
                  <tr key={row.bound}>
                    <th>
                      {row.bound} = {row.value}
                    </th>
                    <td>{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Band>
        )
      )}
      {model.world.length > 0 && (
        <Band cap="world may">
          <ul className={text.plain}>
            {model.world.map(({ row, items }) => (
              <Line key={typeof row === 'string' ? row : row.id}>
                {typeof row === 'string' ? row : <Ref to={row} />}: {items.join(', ')}
              </Line>
            ))}
          </ul>
        </Band>
      )}
      {model.checks && <Band cap="checks">{model.checks}</Band>}
      {model.failing.length > 0 && (
        <Band cap="not passing">
          <ul className={text.plain}>
            {model.failing.map((failure) => (
              <li key={`${failure.rule}:${failure.found}`}>
                {failure.rule}: {failure.found}
                {failure.waits.length > 0 && (
                  <div className={text.sub}>
                    waits on <Waits waits={failure.waits} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Band>
      )}
      {model.changedBy.length > 0 && (
        <Band cap="changed by">
          <ul className={text.refs}>
            {model.changedBy.map((ruling) => (
              <Line key={ruling.id}>
                <Ref to={ruling} />
              </Line>
            ))}
          </ul>
        </Band>
      )}
    </>
  );
}
