// An open question opened (presentation.md §explorer, "Opening": open question).
import type { ThingOf } from '../../../../domain/reading.ts';
import { Band } from '../../../ui/Band.tsx';
import { cx } from '../../../ui/cx.ts';
import { Tag } from '../../../ui/Tag.tsx';
import text from '../../../ui/text.module.css';
import { Decisions, anyDecision } from '../parts/Decisions.tsx';
import { Steps } from '../parts/Steps.tsx';
import styles from './QuestionPanel.module.css';

export function QuestionPanel({ question }: { question: ThingOf<'question'> }) {
  return (
    <>
      <Band cap="question">
        <p className={text.statement}>{question.question}</p>
      </Band>
      <Band cap="readings">
        {question.alternatives.map((alternative) => (
          <div key={alternative.key} className={cx(styles.alternative, alternative.picked && styles.picked)}>
            <b>{alternative.key}</b>
            {alternative.picked && (
              <>
                {' '}
                <Tag>picked</Tag>
              </>
            )}
            {` · ${alternative.polarity === 'must not' ? 'must not happen' : 'should happen'}`}
            <Steps steps={alternative.steps} expectedEnd={alternative.expectedEnd} />
          </div>
        ))}
      </Band>
      {question.recommendation && (
        <Band cap="recommended">
          <b>{question.recommendation.pick}</b>: {question.recommendation.reason}
        </Band>
      )}
      {anyDecision(question.decisions) && (
        <Band cap="decided">
          <Decisions decisions={question.decisions} />
        </Band>
      )}
    </>
  );
}
