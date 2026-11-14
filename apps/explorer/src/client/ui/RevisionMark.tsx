// A revision's mark: a triangle holding its number, as on a drawing (presentation.md §explorer, Revisions).
import styles from './RevisionMark.module.css';

export function RevisionMark({ number }: { number: number }) {
  return (
    <svg className={styles.rev} viewBox="0 0 22 19" width="22" height="19" role="img" aria-label={`revision ${number}`}>
      <path d="M11 1.5 L20.5 17.5 L1.5 17.5 Z" />
      <text x="11" y="15" textAnchor="middle">
        {number}
      </text>
    </svg>
  );
}
