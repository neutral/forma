import styles from './App.module.css';

/** What the page says while no sheet can be drawn: that it is reading, or why it cannot. */
export function Boot({ message }: { message: string }) {
  return (
    <main className={styles.boot}>
      <p>{message}</p>
    </main>
  );
}
