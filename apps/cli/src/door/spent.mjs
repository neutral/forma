// The allowance and what this machine spent of it (door.md §spent, §scratch): the intake in force plus every
// allowance, row by row (decisions.md §intake), and work/spent.json, which counts the answers and engine
// runs spent here. A clone, or a machine whose work/ was deleted, starts with nothing spent.

import { jsonText } from '../record/json.mjs';
import { readBytes, WORK, writeWhole } from '../record/tree.mjs';

/** The allowance's rows (decisions.md §intake) as this module names them. */
const ROWS = {
  answers: 'Answers',
  runs: 'Runs',
  tlcSeconds: 'TLC seconds',
  tlcMegabytes: 'TLC megabytes',
  alloySeconds: 'Alloy seconds',
  alloyMegabytes: 'Alloy megabytes',
  lifecycleSeconds: 'Lifecycle seconds',
};

const whole = (value) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : 0);

/**
 * The allowance in force (decisions.md §intake, door.md §spent), from `force` as decisions.mjs's inForce gives it: the intake in
 * force plus every allowance, row by row, a row not given being 0; before the intake nothing is allowed. Gives
 * `{ answers, runs, engines: { tlc: { seconds, megabytes }, alloy: { seconds, megabytes }, lifecycle: { seconds } } }`.
 */
export function allowanceOf(force) {
  const total = Object.fromEntries(Object.keys(ROWS).map((key) => [key, 0]));
  if (force?.intake) {
    for (const decision of [force.intake, ...(force.allowances ?? [])]) {
      for (const [key, row] of Object.entries(ROWS)) total[key] += whole(decision.rows?.[row]);
    }
  }
  return {
    answers: total.answers,
    runs: total.runs,
    engines: {
      tlc: { seconds: total.tlcSeconds, megabytes: total.tlcMegabytes },
      alloy: { seconds: total.alloySeconds, megabytes: total.alloyMegabytes },
      lifecycle: { seconds: total.lifecycleSeconds },
    },
  };
}

/** Whether an engine is allowed to run at all (evidence.md §limits): some time, and on TLC and Alloy some memory. */
export const engineAllowed = (allowance, engine) => {
  const limits = allowance.engines[engine];
  return Boolean(limits) && limits.seconds > 0 && (engine === 'lifecycle' || limits.megabytes > 0);
};

/**
 * What this machine spent (door.md §spent, §scratch): `{ answers, runs }` from work/spent.json; a file that is absent, does not
 * parse, or is not that object of two whole numbers is read as nothing spent.
 */
export async function readSpent(root) {
  const bytes = await readBytes(root, WORK.spent);
  if (bytes === null) return { answers: 0, runs: 0 };
  try {
    const value = JSON.parse(bytes.toString('utf8'));
    const count = (n) => Number.isSafeInteger(n) && n >= 0;
    if (value && typeof value === 'object' && !Array.isArray(value) && count(value.answers) && count(value.runs)) return { answers: value.answers, runs: value.runs };
  } catch {
    // read as absent (door.md §scratch)
  }
  return { answers: 0, runs: 0 };
}

/** What is left here (door.md §spent): the allowance less what this machine spent, never below zero. */
export const left = (allowance, spent) => ({ answers: Math.max(0, allowance.answers - spent.answers), runs: Math.max(0, allowance.runs - spent.runs) });

/**
 * Counts `count` more `answers` or `runs` spent on this machine (door.md §spent), writing work/spent.json whole from
 * work/tmp/ (door.md §scratch). The caller holds the writer's lock (door.md §lock). Gives what is now spent.
 */
export async function spend(root, what, count = 1) {
  if (what !== 'answers' && what !== 'runs') throw new Error(`what is spent is answers or runs, not ${what}`);
  const spent = await readSpent(root);
  const next = { answers: spent.answers + (what === 'answers' ? count : 0), runs: spent.runs + (what === 'runs' ? count : 0) };
  await writeWhole(root, WORK.spent, jsonText(next));
  return next;
}
