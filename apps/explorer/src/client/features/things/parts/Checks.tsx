// A thing's checks on one model (presentation.md §explorer, Checks): those asked now, and those run on an
// earlier model, which are marked `·` and never `✓`.
import type { ReactNode } from 'react';
import type { Check, Checks as ChecksOnModel } from '../../../../domain/reading.ts';
import { cx } from '../../../ui/cx.ts';
import { Fold } from '../../../ui/Fold.tsx';
import { Glyph } from '../../../ui/Mark.tsx';
import text from '../../../ui/text.module.css';
import { LABEL, plural } from '../../../../domain/words.ts';
import styles from './Checks.module.css';

const MARK: Record<Check['mark'], { glyph: string; tone: 'plain' | 'quiet' }> = {
  yes: { glyph: '✓', tone: 'plain' },
  no: { glyph: '✗', tone: 'plain' },
  unanswered: { glyph: '○', tone: 'quiet' },
  none: { glyph: '○', tone: 'quiet' },
  earlier: { glyph: '·', tone: 'quiet' },
};

export function Checks({ checks }: { checks: ChecksOnModel }) {
  const { now, earlier } = checks;
  const earlierList = <CheckList checks={earlier} />;
  return (
    <>
      {now.length > 0 && <CheckList checks={now} />}
      {earlier.length > 0 &&
        (now.length > 0 ? (
          <Fold summary={`${LABEL.earlierModel} · ${plural(earlier.length, 'check')}`}>{earlierList}</Fold>
        ) : (
          <>
            <p className={text.sub}>{LABEL.earlierModel}</p>
            {earlierList}
          </>
        ))}
    </>
  );
}

function CheckList({ checks }: { checks: Check[] }) {
  return (
    <ul className={styles.checks}>
      {checks.map((check) => (
        <CheckLine key={check.question} check={check} />
      ))}
    </ul>
  );
}

function CheckLine({ check }: { check: Check }) {
  const { glyph, tone } = MARK[check.mark];
  return (
    <li className={styles.line}>
      <Glyph tone={tone}>{glyph}</Glyph>
      <div>
        <span className={styles.what} title={check.question}>
          {check.what}
        </span>
        {check.says && <>: {check.says}</>}
        <div className={text.sub}>
          <b>{check.result}</b>
          {check.details && ` · ${check.details}`}
        </div>
        {check.flags.length > 0 && <div className={text.sub}>flags: {check.flags.join(', ')}</div>}
        {check.stale && <div className={cx(text.sub, text.muted)}>{check.stale}</div>}
        {check.path && (
          <Fold summary={`path · ${plural(check.path.length - 1, 'step')}`}>
            <ol className={styles.trace} start={0}>
              {check.path.map((line, i) => (
                <li key={i} className={i === 0 ? text.muted : undefined}>
                  {line}
                </li>
              ))}
            </ol>
          </Fold>
        )}
      </div>
    </li>
  );
}

/** A line of a check list that is not a check: a condition not yet in place, or an engine that cannot express a claim. */
export function CheckLikeList({ lines }: { lines: { key: string; glyph: string; body: ReactNode }[] }) {
  return (
    <ul className={styles.checks}>
      {lines.map(({ key, glyph, body }) => (
        <li key={key} className={styles.line}>
          <Glyph tone="quiet">{glyph}</Glyph>
          <div>{body}</div>
        </li>
      ))}
    </ul>
  );
}
