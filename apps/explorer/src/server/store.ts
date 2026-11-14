// The read index in SQLite (project.md §explore, "The read index"): each generation's two readings,
// stored whole in one transaction, the latest two generations kept. It is a disposable cache: a file
// of another application or schema version is deleted and built again, never read.
import { DatabaseSync } from 'node:sqlite';
import { rmSync } from 'node:fs';
import type { Snapshot, Standing } from '../domain/reading.ts';

export const APPLICATION_ID = 0x46585052; // "FXPR"
export const SCHEMA_VERSION = 1;
const KEPT = 2;

const SCHEMA = `
CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  written INTEGER NOT NULL UNIQUE,
  computed_at TEXT NOT NULL
) STRICT;
CREATE TABLE readings (
  generation TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  standing TEXT NOT NULL CHECK (standing IN ('recorded', 'here')),
  sheet TEXT NOT NULL,
  PRIMARY KEY (generation, standing)
) STRICT;
CREATE TABLE things (
  generation TEXT NOT NULL,
  standing TEXT NOT NULL,
  id TEXT NOT NULL,
  thing TEXT NOT NULL,
  PRIMARY KEY (generation, standing, id),
  FOREIGN KEY (generation, standing) REFERENCES readings(generation, standing) ON DELETE CASCADE
) STRICT;
PRAGMA application_id = ${APPLICATION_ID};
PRAGMA user_version = ${SCHEMA_VERSION};
`;

export interface Store {
  /** The file it is kept in, or null in memory. */
  readonly file: string | null;
  /** The generations kept, the latest first. */
  generations(): string[];
  computedAt(generation: string): string | undefined;
  /** A sheet as its stored JSON text. */
  sheet(generation: string, standing: Standing): string | undefined;
  /** A thing as its stored JSON text. */
  thing(generation: string, standing: Standing, id: string): string | undefined;
  /** Stores a generation whole, unless it is already kept, and drops all but the latest two. */
  put(snapshot: Snapshot): void;
  close(): void;
}

const pragma = (db: DatabaseSync, name: string): unknown => Object.values(db.prepare(`PRAGMA ${name}`).get() ?? {})[0];

/** The database at `path` when it holds this schema or nothing yet; it throws when it holds anything else. */
function attach(path: string): DatabaseSync {
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: true, timeout: 5000 });
  try {
    if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
    if (db.prepare('SELECT count(*) AS n FROM sqlite_schema').get()?.n === 0) db.exec(SCHEMA);
    else if (pragma(db, 'application_id') !== APPLICATION_ID || pragma(db, 'user_version') !== SCHEMA_VERSION)
      throw new Error(`${path} holds another application's or another version's schema.`);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

/** Opens the store at `path` (a file, or `:memory:`). */
export function openStore(path: string): Store {
  let db: DatabaseSync;
  try {
    db = attach(path);
  } catch (error) {
    if (path === ':memory:') throw error;
    for (const suffix of ['', '-wal', '-shm']) rmSync(`${path}${suffix}`, { force: true });
    db = attach(path);
  }
  const text = (row: Record<string, unknown> | undefined, column: string) =>
    row === undefined ? undefined : String(row[column]);
  const statements = {
    generations: db.prepare('SELECT id FROM generations ORDER BY written DESC'),
    computedAt: db.prepare('SELECT computed_at FROM generations WHERE id = ?'),
    sheet: db.prepare('SELECT sheet FROM readings WHERE generation = ? AND standing = ?'),
    thing: db.prepare('SELECT thing FROM things WHERE generation = ? AND standing = ? AND id = ?'),
    kept: db.prepare('SELECT 1 FROM generations WHERE id = ?'),
    generation: db.prepare(
      'INSERT INTO generations (id, written, computed_at) VALUES (?, (SELECT coalesce(max(written), 0) + 1 FROM generations), ?)',
    ),
    reading: db.prepare('INSERT INTO readings (generation, standing, sheet) VALUES (?, ?, ?)'),
    item: db.prepare('INSERT INTO things (generation, standing, id, thing) VALUES (?, ?, ?, ?)'),
    prune: db.prepare(`DELETE FROM generations WHERE id NOT IN (SELECT id FROM generations ORDER BY written DESC LIMIT ${KEPT})`),
  };
  return {
    file: path === ':memory:' ? null : path,
    generations: () => statements.generations.all().map((row) => String(row.id)),
    computedAt: (generation) => text(statements.computedAt.get(generation), 'computed_at'),
    sheet: (generation, standing) => text(statements.sheet.get(generation, standing), 'sheet'),
    thing: (generation, standing, id) => text(statements.thing.get(generation, standing, id), 'thing'),
    put(snapshot) {
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!statements.kept.get(snapshot.generation)) {
          statements.generation.run(snapshot.generation, snapshot.computedAt);
          for (const [standing, reading] of Object.entries(snapshot.readings)) {
            statements.reading.run(snapshot.generation, standing, JSON.stringify(reading.sheet));
            for (const [id, thing] of Object.entries(reading.things))
              statements.item.run(snapshot.generation, standing, id, JSON.stringify(thing));
          }
          statements.prune.run();
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => db.close(),
  };
}
