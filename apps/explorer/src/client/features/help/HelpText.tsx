// What the marks and words mean, and how to read the page: said only here (presentation.md §explorer, No filler).
import styles from './Help.module.css';

export function HelpText() {
  return (
    <>
      <h2 className={styles.heading}>Reading</h2>
      <ul>
        <li>The developer's documents, as written, in reading order.</li>
        <li>Beside each section: what the examination made of it, where it is first met.</li>
        <li>An underlined name opens in place, and <i>close</i> shuts it. Names inside open further.</li>
        <li>Grey: first met in an earlier section.</li>
        <li>At the end: every claim, every assumption, the models, the limits.</li>
      </ul>
      <h2 className={styles.heading}>Marks</h2>
      <dl className={styles.marks}>
        <dt>●</dt>
        <dd>established</dd>
        <dt>◐</dt>
        <dd>accepted, unexamined</dd>
        <dt>○</dt>
        <dd>not established, or not yet</dd>
        <dt className={styles.diff}>△</dt>
        <dd>a revision: a fault the examination found in the design, numbered and listed in the title block</dd>
        <dt>✓</dt>
        <dd>a check that came out as expected</dd>
        <dt>✗</dt>
        <dd>a check that did not</dd>
        <dt>·</dt>
        <dd>a check run on an earlier model, not asked now</dd>
        <dt>○</dt>
        <dd>beside a check: not run, or did not finish</dd>
        <dt>×</dt>
        <dd>this engine cannot express the claim</dd>
      </dl>
      <h2 className={styles.heading}>Lines</h2>
      <dl>
        <dt>margin rule</dt>
        <dd>Divides the document from its notes. A tick marks where each section starts.</dd>
        <dt>solid left line</dt>
        <dd>An opened thing. On a claim: established, or accepted.</dd>
        <dt>dashed left line</dt>
        <dd>A claim not established.</dd>
        <dt>red line</dt>
        <dd>A revision.</dd>
      </dl>
      <h2 className={styles.heading}>Words</h2>
      <dl>
        <dt>claim</dt>
        <dd>What must hold.</dd>
        <dt>established</dt>
        <dd>Checked on a model, within that model's bounds, with every assumption taken on.</dd>
        <dt>accepted, unexamined</dt>
        <dd>The developer accepts the risk without examination.</dd>
        <dt>assumption</dt>
        <dd>Not checked. Taken on: the developer carries it, with what would falsify it and who answers for it.</dd>
        <dt>bounds</dt>
        <dd>The sizes a model was checked at. That a claim holds beyond them is an assumption.</dd>
        <dt>scenario</dt>
        <dd>Steps that should happen, or must not.</dd>
        <dt>lifecycle</dt>
        <dd>One thing's states, and what each action does in each.</dd>
        <dt>open question</dt>
        <dd>Something the text left open, settled by the developer's pick.</dd>
        <dt>part, span</dt>
        <dd>A part is one component. A span is where two parts meet.</dd>
        <dt>beyond the text</dt>
        <dd>Restated, but not said outright in the section it cites.</dd>
        <dt>left out</dt>
        <dd>A section, or part of one, not examined, with the reason.</dd>
      </dl>
      <h2 className={styles.heading}>Checks</h2>
      <dl>
        <dt>check</dt>
        <dd>The claim holds in every state searched.</dd>
        <dt>planted defect</dt>
        <dd>One mechanism removed. A check counts only once it has caught the defect.</dd>
        <dt>reachable case</dt>
        <dd>A state the claim is about, shown to occur.</dd>
        <dt>seven conditions</dt>
        <dd>
          Confirmation; check; planted defect caught; cases reachable; model passes its scenarios; assumptions taken on; no open
          surprise. A claim is established on a model when all seven hold.
        </dd>
        <dt>model passes its scenarios</dt>
        <dd>A model's claims count only once it runs the scenarios the developer confirmed.</dd>
        <dt>phases only</dt>
        <dd>The lifecycle engine checks phases and moves, with guards unevaluated. What it establishes holds at phase level.</dd>
      </dl>
      <h2 className={styles.heading}>Findings</h2>
      <dl>
        <dt>surprise</dt>
        <dd>A check that came out unexpectedly. The developer rules on it.</dd>
        <dt>ruling</dt>
        <dd>
          Design at fault (a revision, △ beside its section), model at fault, claim misstated, or restatement too coarse. A repair
          follows.
        </dd>
        <dt>repair added</dt>
        <dd>
          A mechanism the repair put in the model, marked against the document: stated, not in the document and accepted, or not in
          the document.
        </dd>
      </dl>
      <h2 className={styles.heading}>Decisions</h2>
      <dl>
        <dt>kinds</dt>
        <dd>
          Confirmed, declined, picked, ruled, taken on, accepted without examination, placed against the document, allowed,
          intake, redirected.
        </dd>
        <dt>lapsed</dt>
        <dd>What it was made on has changed since.</dd>
        <dt>replaced</dt>
        <dd>A later decision stands in its place.</dd>
        <dt>revoked</dt>
        <dd>A fault found in the design withdrew it. Only a later decision takes the assumption on again.</dd>
        <dt>declared</dt>
        <dd>Who decided is as declared, and is not checked.</dd>
      </dl>
      <h2 className={styles.heading}>Standing</h2>
      <dl>
        <dt>as recorded</dt>
        <dd>Each run judged by the versions it names.</dd>
        <dt>here</dt>
        <dd>Judged by this machine's versions. On a different build, runs must repeat before they count.</dd>
      </dl>
      <h2 className={styles.heading}>Keys</h2>
      <dl>
        <dt>?</dt>
        <dd>help</dd>
        <dt>Esc</dt>
        <dd>closes the help, or else the thing opened last</dd>
      </dl>
    </>
  );
}
