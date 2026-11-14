import type { ReactNode } from 'react';
import { Line } from '../../../ui/opening/Line.tsx';
import styles from './OnModel.module.css';

/** What a thing comes to on one model: a head line naming the model, then what it holds there. */
export function OnModel({ head, children }: { head: ReactNode; children?: ReactNode }) {
  return (
    <div className={styles.onModel}>
      <Line as="div" className={styles.head}>
        {head}
      </Line>
      {children}
    </div>
  );
}

/** The head's quieter words: how the model holds it. */
export const HeadNote = ({ children }: { children: ReactNode }) => <span className={styles.note}>{children}</span>;

/** The head's code: an action's operator. */
export const HeadCode = ({ children }: { children: ReactNode }) => <span className={styles.code}>{children}</span>;
