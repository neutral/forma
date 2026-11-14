// A passage as the developer wrote it. This is the page's one insertion of HTML, and it is safe for one
// reason: the domain renders the passage from Markdown with raw HTML disabled (markdown-it, `html: false`),
// so the string holds only the tags markdown-it writes, with every character of the developer's text
// escaped. Links between the brief's documents already point within the page.
import styles from './Prose.module.css';

export function Prose({ html }: { html: string }) {
  return <div className={styles.prose} dangerouslySetInnerHTML={{ __html: html }} />;
}
