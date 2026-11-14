// The notes beside a passage (presentation.md §explorer, Notes): only what is first met there, in the
// reading's order, each kind under its own label. A name in them opens under the passage.
import type { ReactNode } from 'react';
import type { Note } from '../../../domain/reading.ts';
import { cx } from '../../ui/cx.ts';
import { Fold } from '../../ui/Fold.tsx';
import { Ref } from '../../ui/Ref.tsx';
import { RevisionMark } from '../../ui/RevisionMark.tsx';
import { Tag } from '../../ui/Tag.tsx';
import text from '../../ui/text.module.css';
import styles from './Notes.module.css';

type NoteOf<K extends Note['kind']> = Extract<Note, { kind: K }>;

export function Notes({ notes }: { notes: Note[] }) {
  return notes.map((note, i) => <NoteView key={i} note={note} />);
}

function NoteView({ note }: { note: Note }) {
  switch (note.kind) {
    case 'found':
      return <Found note={note} />;
    case 'corrected':
      return <Corrected note={note} />;
    case 'leftOpen':
      return <LeftOpen note={note} />;
    case 'leftOut':
      return <LeftOut note={note} />;
    case 'mustHold':
      return <MustHold note={note} />;
    case 'assumes':
      return <Assumes note={note} />;
    case 'restated':
      return <Restated note={note} />;
    case 'alsoAbove':
      return <AlsoAbove note={note} />;
  }
}

/** One note: its label, red for a revision and for an open question no pick has settled. */
function Labelled({ cap, flag, children }: { cap: string; flag?: boolean; children: ReactNode }) {
  return (
    <div className={styles.note}>
      <div className={cx(text.cap, styles.cap, flag && styles.flag)}>{cap}</div>
      <div>{children}</div>
    </div>
  );
}

const BRIEF = { stated: 'the document states it', accepted: 'not in the document, accepted', absent: 'not in the document' };

function Found({ note }: { note: NoteOf<'found'> }) {
  return (
    <Labelled cap="found" flag>
      {note.revisions.map((revision) => (
        <div key={revision.number} className={styles.revision}>
          <RevisionMark number={revision.number} />
          <div>
            <Ref to={revision.ref} />
            {revision.added.map((added, i) => (
              <div key={i} className={text.sub}>
                repair added: {added.mechanism} <span className={added.brief === 'absent' ? text.diff : undefined}>{BRIEF[added.brief]}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Labelled>
  );
}

const Names = ({ refs }: { refs: NoteOf<'mustHold'>['refs'] }) => (
  <ul className={text.refs}>
    {refs.map((named) => (
      <li key={named.id}>
        <Ref to={named} />
      </li>
    ))}
  </ul>
);

const Corrected = ({ note }: { note: NoteOf<'corrected'> }) => (
  <Labelled cap="corrected">
    <Names refs={note.refs} />
  </Labelled>
);

const LeftOpen = ({ note }: { note: NoteOf<'leftOpen'> }) => (
  <Labelled cap="left open" flag={!note.settled}>
    <Ref to={note.ref} />
    <div className={text.sub}>{note.settled ? `settled: ${note.settled}` : 'unsettled'}</div>
  </Labelled>
);

const LeftOut = ({ note }: { note: NoteOf<'leftOut'> }) => (
  <Labelled cap="left out">
    {note.reason}
    {note.confirmation && (
      <>
        {' '}
        <Tag>{note.confirmation}</Tag>
      </>
    )}
  </Labelled>
);

const MustHold = ({ note }: { note: NoteOf<'mustHold'> }) => (
  <Labelled cap="must hold">
    <Names refs={note.refs} />
  </Labelled>
);

const Assumes = ({ note }: { note: NoteOf<'assumes'> }) => (
  <Labelled cap="assumes">
    <Names refs={note.refs} />
  </Labelled>
);

const Restated = ({ note }: { note: NoteOf<'restated'> }) => (
  <Labelled cap="restated">
    <Ref to={note.ref} />
    {note.beyond > 0 && <div className={text.sub}>{note.beyond} beyond the text</div>}
  </Labelled>
);

const AlsoAbove = ({ note }: { note: NoteOf<'alsoAbove'> }) => (
  <Labelled cap="">
    <Fold summary={`also above: ${note.label}`} small>
      <Names refs={note.refs} />
    </Fold>
  </Labelled>
);
