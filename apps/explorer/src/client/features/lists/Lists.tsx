// The four lists after the documents (presentation.md §explorer, The lists), each thing once, as ruled
// schedules. A name in a list opens under that list, one at a time.
import type { ReactNode } from 'react';
import type { Sheet } from '../../../domain/reading.ts';
import { cx } from '../../ui/cx.ts';
import { OpenedThings } from '../../ui/opening/OpenedThings.tsx';
import { TargetContext, useOpenings } from '../../ui/opening/targets.ts';
import { PageLink } from '../../ui/PageLink.tsx';
import { Ref } from '../../ui/Ref.tsx';
import text from '../../ui/text.module.css';
import styles from './Lists.module.css';

type Lists = Sheet['lists'];

/** The lists, by the id each has on the page and the title it stands under. */
export const LISTS = [
  { id: 'claims', title: 'Claims' },
  { id: 'assumptions', title: 'Assumptions' },
  { id: 'examination', title: 'Examination' },
  { id: 'limits', title: 'Limits' },
] as const;

export function ListsAtTheEnd({ lists }: { lists: Lists }) {
  const [claims, assumptions, examination, limits] = LISTS;
  return (
    <>
      <List {...claims}>
        <ClaimSchedule groups={lists.claims} />
      </List>
      <List {...assumptions}>
        <AssumptionSchedule schedule={lists.assumptions} />
      </List>
      <List {...examination}>
        <ExaminationSchedules examination={lists.examination} />
      </List>
      <List {...limits}>
        <ul className={styles.limits}>
          {lists.limits.map((sentence) => (
            <li key={sentence}>{sentence}</li>
          ))}
        </ul>
      </List>
    </>
  );
}

function List({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const openings = useOpenings(true);
  return (
    <section className={styles.list} id={id}>
      <h2 className={cx(text.forma, styles.title)}>{title}</h2>
      <div className={cx(text.forma, styles.body)}>
        <TargetContext value={openings.target}>{children}</TargetContext>
      </div>
      <OpenedThings openings={openings} placement="start" />
    </section>
  );
}

function Head({ columns }: { columns: { label: string; num?: boolean }[] }) {
  return (
    <thead>
      <tr>
        {columns.map(({ label, num }) => (
          <th key={label} className={cx(text.cap, num && styles.num)}>
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function ClaimSchedule({ groups }: { groups: Lists['claims'] }) {
  return (
    <table className={styles.schedule}>
      <Head columns={[{ label: 'claim' }, { label: 'standing' }, { label: 'section' }]} />
      <tbody>
        {groups.map((group) => [
          <tr key={group.title} className={styles.group}>
            <th colSpan={3}>
              {group.title}
              {group.span && ' · span'}
              {group.shared && ` · each ${group.shared}`}
            </th>
          </tr>,
          ...group.rows.map((row) => (
            <tr key={row.ref.id}>
              <td>
                <Ref to={row.ref} />
              </td>
              <td>{row.says}</td>
              <td>{row.section && <PageLink to={row.section.sectionId}>{row.section.heading}</PageLink>}</td>
            </tr>
          )),
        ])}
      </tbody>
    </table>
  );
}

function AssumptionSchedule({ schedule }: { schedule: Lists['assumptions'] }) {
  return (
    <table className={styles.schedule}>
      <Head columns={[{ label: 'assumption' }, { label: 'answered by' }, { label: 'claims', num: true }]} />
      <tbody>
        {schedule.rows.map((row) => (
          <tr key={row.ref.id}>
            <td>
              <Ref to={row.ref} />
            </td>
            <td>{row.provider}</td>
            <td className={styles.num}>{row.claims}</td>
          </tr>
        ))}
        {schedule.bounds.map((group) => [
          <tr key={group.model.id} className={styles.group}>
            <th colSpan={3}>
              beyond the bounds of <Ref to={group.model} />
              {group.bounds && (
                <>
                  {' · '}
                  <span className={styles.plain}>{group.bounds}</span>
                </>
              )}
              {` · taken on for ${group.taken} of ${group.rows.length}`}
            </th>
          </tr>,
          ...group.rows.map((row) => (
            <tr key={row.ref.id}>
              <td>
                <Ref to={row.ref} />
              </td>
              <td>{row.provider}</td>
              <td className={styles.num}>1</td>
            </tr>
          )),
        ])}
      </tbody>
    </table>
  );
}

function ExaminationSchedules({ examination }: { examination: Lists['examination'] }) {
  return (
    <>
      <table className={styles.schedule}>
        <Head columns={[{ label: 'model' }, { label: 'engine' }, { label: 'covers' }, { label: 'established', num: true }]} />
        <tbody>
          {examination.models.map((model) => (
            <tr key={model.ref.id}>
              <td>
                <Ref to={model.ref} />
              </td>
              <td>{model.engine}</td>
              <td>{model.covers}</td>
              <td className={styles.num}>{model.established}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {examination.corrections.length > 0 && (
        <table className={styles.schedule}>
          <Head columns={[{ label: 'correction' }, { label: 'on' }]} />
          <tbody>
            {examination.corrections.map((correction) => (
              <tr key={correction.ref.id}>
                <td>{correction.kind}</td>
                <td>
                  <Ref to={correction.ref} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <table className={styles.schedule}>
        <Head columns={[{ label: 'decisions' }, { label: 'by, as declared' }]} />
        <tbody>
          {examination.decisions.map((maker) => (
            <tr key={maker.by}>
              <td className={styles.num}>{maker.count}</td>
              <td>{maker.by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
