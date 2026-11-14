// `forma decide` (decisions.md §forma-decide, with decisions.md §intake to §redirect): each kind of decision written through ../record/decisions.mjs's
// decisionText and writeDecision, given its options and the token `forma show` printed, or asked at a
// terminal; a ruling's `## Surprises` and `## Kept`, and what it removes (decisions.md §rulings, §kept-journeys; evidence.md §at-ruling);
// a redirect's page and receipt line (decisions.md §redirect). Everything it refuses, it refuses before writing.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ALLOWANCE, CADENCES, decisionFolderFor, decisionText, LEVELS, nextAt, rulingSubject, SITUATIONS, statedWordsReason, VERDICTS, writeDecision } from '../record/decisions.mjs';
import { aheadOfClock, sha256 } from '../record/json.mjs';
import { MENU_NAMES } from '../record/models.mjs';
import { readProject } from '../record/project.mjs';
import { sameSession, takeIn } from '../record/receipts.mjs';
import { strikeFalsifier } from '../record/pins.mjs';
import { withLock } from '../door/lock.mjs';
import { sessionsSeen } from '../door/work.mjs';
import { removeClosed } from '../evidence/run.mjs';
import { accountOf } from '../account/index.mjs';
import { onsOf, parseArgs, pickBlocked, reason, refusedResult, showingOf, showText } from './show.mjs';

const SESSION = ['--provider', '--model', '--session'];
const ALLOWANCE_OPTIONS = ['--answers', '--runs', '--tlc-seconds', '--tlc-megabytes', '--alloy-seconds', '--alloy-megabytes', '--lifecycle-seconds'];
const SETTINGS_OPTIONS = ['--cadence', '--inbox-cap'];
const ROW_OF = Object.fromEntries(ALLOWANCE_OPTIONS.map((o, i) => [o, ALLOWANCE[i]]));

/** The options each kind takes (decisions.md §forma-decide). */
const TAKES = {
  intake: ['--by', ...SESSION, '--situation', ...ALLOWANCE_OPTIONS, ...SETTINGS_OPTIONS, '--words'],
  allow: ['--by', ...SESSION, ...ALLOWANCE_OPTIONS, ...SETTINGS_OPTIONS],
  confirm: ['--shown', '--by', ...SESSION],
  decline: ['--shown', '--by', ...SESSION, '--words'],
  pick: ['--shown', '--by', ...SESSION, '--choice'],
  rule: ['--shown', '--by', ...SESSION, '--verdict', '--level', '--target', '--basis', '--words'],
  carry: ['--shown', '--by', ...SESSION, '--choice', '--basis', '--words'],
  accept: ['--shown', '--by', ...SESSION, '--choice', '--words'],
  redirect: ['--shown', '--by', ...SESSION, '--words', '--from'],
  brief: ['--shown', '--by', ...SESSION, '--choice', '--words'],
};
const ALL = [...new Set(Object.values(TAKES).flat())];
const CHOICES = { pick: ['a', 'b'], carry: ['carry', 'withdraw'], accept: ['accept', 'withdraw'], brief: ['stated', 'accepted'] };

/**
 * The words a showing is computed with (decisions.md §forma-show, §forma-decide): a redirect's new sentence, and a brief decision's
 * addresses when it is stated, since its showing and its pin hold the passages named; none otherwise.
 */
function showingWords(kind, given, fromText) {
  if (kind === 'redirect') return fromText ? null : given.get('--words') ?? null;
  if (kind === 'brief') return given.get('--choice') === 'stated' ? given.get('--words') ?? '' : null;
  return null;
}
const whole = (text) => /^\d+$/.test(String(text));
const blank = (text) => text === undefined || text === null || !/\S/.test(String(text));

/**
 * The parts a premise belongs to, which its carry's basis claim may not have (decisions.md §carry): a premise's own part,
 * its row's part, for bounds the claim's parts, for a span both parts.
 */
function premiseParts(a, name) {
  let m;
  if ((m = /^([^/:]+)\/premises\//.exec(name))) return [m[1]];
  if ((m = /^(?:store|strike):([^/]+)\//.exec(name))) return [m[1]];
  if ((m = /^span:([^+]+)\+(.+)$/.exec(name))) return [m[1], m[2]];
  if ((m = /^bound:[^/]+\/([^/]+)\/([^/]+)$/.exec(name))) return a.project.restatement.thingParts.get(`${m[1]}/claims/${m[2]}`) ?? [m[1]];
  return [];
}

/**
 * What the developer gives, at a terminal: each choice, the words and the name (decisions.md §forma-decide), the showing printed
 * first through `write`, so it is read before anything is asked; without `write`, it leads the command's output.
 */
async function ask(readLine, write, showing, kind, given, out, reshow = null) {
  if (write) await write(showText(showing));
  else out.push(showText(showing));
  const want = async (option, prompt) => {
    if (given.has(option)) return;
    const value = await readLine(prompt);
    if (value !== null && value !== undefined && String(value) !== '') given.set(option, String(value));
  };
  if (kind === 'intake') await want('--situation', `Situation (${SITUATIONS.join(', ')}): `);
  if (kind === 'intake' || kind === 'allow') {
    for (const option of ALLOWANCE_OPTIONS) await want(option, `${ROW_OF[option]} (a whole number, 0 or more): `);
    await want('--cadence', `Cadence (${CADENCES.join(', ')}${kind === 'intake' ? '; span when none is given' : '; unchanged when none is given'}): `);
    await want('--inbox-cap', `Inbox cap (a whole number${kind === 'intake' ? '; 7 when none is given' : '; unchanged when none is given'}): `);
  }
  if (kind === 'intake') await want('--words', 'What is out of scope, and why: ');
  if (kind === 'pick') await want('--choice', `Choice (${(showing.allowed ?? ['a', 'b']).join(' or ')}): `);
  if (kind === 'carry' || kind === 'accept') await want('--choice', `Choice (${CHOICES[kind].join(' or ')}): `);
  if (kind === 'rule') {
    await want('--verdict', `Verdict (${VERDICTS.join(', ')}): `);
    await want('--level', `Level (${LEVELS.join(', ')}): `);
    if (given.get('--verdict') === 'real finding') await want('--target', 'Target: ');
    await want('--basis', 'Basis (or -): ');
  }
  if (kind === 'carry' && given.get('--choice') === 'carry') await want('--basis', 'Basis (a claim, or -): ');
  const wordsWanted = ['decline', 'rule'].includes(kind) || (kind === 'carry' && given.get('--choice') === 'carry') || (kind === 'accept' && given.get('--choice') === 'accept');
  if (wordsWanted) await want('--words', kind === 'decline' ? 'Reason: ' : kind === 'rule' ? 'Direction: ' : kind === 'carry' ? 'Falsifier: ' : 'Why its risk is accepted: ');
  if (kind === 'brief') {
    await want('--choice', `Choice (${CHOICES.brief.join(' or ')}): `);
    if (given.get('--choice') === 'accepted') await want('--words', 'Why the difference is accepted: ');
    if (given.get('--choice') === 'stated') {
      // The address of each brief passage that states the mechanism, one a line, an empty line ending them (decisions.md §kinds, §rulings).
      if (!given.has('--words')) {
        const addresses = [];
        for (;;) {
          const value = await readLine(addresses.length ? 'Another address, or an empty line to end: ' : 'The address of each brief passage that states the mechanism, one a line, an empty line to end: ');
          if (value === null || value === undefined || String(value).trim() === '') break;
          addresses.push(String(value).trim());
        }
        if (addresses.length) given.set('--words', addresses.join('\n'));
      }
      // Shown again with the passages named, before the name is asked (decisions.md §forma-decide).
      if (given.has('--words') && reshow) await reshow();
    }
  }
  await want('--by', 'Your name: ');
}

/**
 * `forma decide <kind> [<on>] [<option> ...]` (decisions.md §forma-decide). `io` gives `stdinIsTTY`, `stdoutIsTTY` and
 * `readLine(prompt)`, which resolves to the line typed. Returns `{ status, stdout, stderr }`.
 */
export async function decideCommand(root, argv = [], { stdinIsTTY = false, stdoutIsTTY = false, readLine = null, write = null, now = () => new Date() } = {}) {
  const { positional, options, refused: parsed } = parseArgs(argv, ALL);
  const json = options.get('--json') === true;
  if (parsed.length) return refusedResult(parsed, json);
  if (!positional.length) return refusedResult([reason('decisions.md §forma-decide', 'forma decide names the kind of decision')], json);
  if (positional.length > 2) return refusedResult([reason('project.md §commands', `forma decide takes a kind and what it is on, and was given ${positional.length} arguments`)], json);
  const [kind, onText] = positional;
  const takes = TAKES[kind];
  if (!takes) return refusedResult([reason('decisions.md §forma-show', `"${kind}" is no kind of decision: one of ${Object.keys(TAKES).join(', ')}`)], json);
  const refused = [];
  for (const option of options.keys()) if (option !== '--json' && !takes.includes(option)) refused.push(reason('decisions.md §forma-decide', `a ${kind} takes no ${option}`));
  if (refused.length) return refusedResult(refused, json);

  const terminal = Boolean(stdinIsTTY && stdoutIsTTY && readLine);
  // Given --shown, or for the intake or an allowance any of their own options, it asks nothing (decisions.md §forma-decide): their own are
  // the choices they show (presentation.md §showings), the situation and words of the intake, the allowance's rows and the settings; the name
  // and the session are every decision's.
  const OWN = kind === 'intake' ? ['--situation', '--words', ...ALLOWANCE_OPTIONS, ...SETTINGS_OPTIONS] : [...ALLOWANCE_OPTIONS, ...SETTINGS_OPTIONS];
  const ownGiven = kind === 'intake' || kind === 'allow' ? OWN.some((o) => options.has(o)) : options.has('--shown');
  if (!ownGiven && !terminal) return refusedResult([reason('decisions.md §forma-decide', kind === 'intake' || kind === 'allow' ? `standard input or output is not a terminal, so the ${kind === 'intake' ? 'intake' : 'allowance'} is given its options` : 'standard input or output is not a terminal, so the decision is given its options, the token forma show printed among them (--shown)')], json);

  let fromText = null;
  if (options.has('--from')) {
    try { fromText = await readFile(resolve(options.get('--from')), 'utf8'); } catch (error) { return refusedResult([reason('decisions.md §forma-decide', `--from names no file that can be read: ${error.message}`)], json); }
  }
  // Everything is checked before the lock is taken, so a refused decision writes nothing, not even work/lock
  // (door.md §clock); under the lock the project is read again and the decision written only if it reads as it was shown.
  const out = [];
  const a = await accountOf(root);
  const ons = onsOf(onText);
  const given = new Map([...options].filter(([k]) => k !== '--json'));
  let showing = showingOf(a, kind, ons, { words: showingWords(kind, given, fromText), fromText });
  const fail = (reasons) => {
    const res = refusedResult(reasons, json);
    return json ? res : { ...res, stdout: `${out.join('')}${res.stdout}` };
  };
  if (showing.refused) return fail(showing.refused);
  if (kind === 'intake' && a.design.force.intake) return fail([reason('decisions.md §intake', `the intake is made once, and ${a.design.force.intake.name} is in force`)]);
  // At a terminal, a stated brief decision is shown again with the passages its addresses name, and records that showing (decisions.md §forma-decide).
  let reshown = null;
  const reshow = async () => {
    const again = showingOf(a, kind, ons, { words: showingWords(kind, given, fromText), fromText });
    reshown = again;
    if (again.refused) return;
    if (write) await write(showText(again));
    else out.push(showText(again));
  };
  if (!ownGiven) await ask(readLine, write, showing, kind, given, out, kind === 'brief' ? reshow : null);
  if (reshown?.refused) return fail(reshown.refused);
  if (reshown) showing = reshown;
  else if (kind === 'brief' && !ownGiven) {
    // The choice given at the terminal sets which showing the decision records.
    showing = showingOf(a, kind, ons, { words: showingWords(kind, given, fromText), fromText });
    if (showing.refused) return fail(showing.refused);
  }
  const at = now();
  const checked = await record(root, a, kind, ons, showing, given, { terminal, asked: !ownGiven, fromText, now: at, write: false });
  if (checked.refused.length) return fail(checked.refused);
  let result;
  try {
    result = await withLock(root, async () => {
      const again = await readProject(root);
      let b = a;
      if (fingerprint(again) !== fingerprint(a.project)) {
        b = await accountOf(root, { project: again });
        const now2 = showingOf(b, kind, ons, { words: showingWords(kind, given, fromText), fromText });
        if (now2.refused) return { refused: now2.refused };
        if (now2.token !== showing.token) return { refused: [reason('decisions.md §forma-decide', 'what the decision is on changed while it was being made, so it no longer reads as it was shown: show it again')] };
      }
      return record(root, b, kind, ons, showing, given, { terminal, asked: !ownGiven, fromText, now: at, write: true });
    });
  } catch (error) {
    return fail([reason('door.md §lock', error.message)]);
  }
  if (result.refused?.length) return fail(result.refused);
  if (json) return { status: 0, stdout: `${JSON.stringify({ recorded: result.recorded, written: result.written, removed: result.removed }, null, 2)}\n`, stderr: '' };
  // The path of each decision recorded, then each page written, then `removed <path>` for each file removed, as forma run prints a removal (decisions.md §forma-decide).
  const printed = [...result.recorded, ...result.written, ...result.removed.map((p) => `removed ${p}`)];
  return { status: 0, stdout: `${out.join('')}${printed.map((p) => `${p}\n`).join('')}`, stderr: '' };
}

/** What every tracked file holds, as one text: two reads with one fingerprint compute one account (account.md §what-it-is). */
function fingerprint(project) {
  const files = [...project.files.values()].map((f) => `${f.path}\0${f.sha256}`).sort();
  const receipts = [...project.receipts.values()].map((x) => `${x.path}\0${x.lines.map((l) => l.text).join('\n')}`).sort();
  const decisions = project.decisions.map((d) => d.path).sort();
  const brief = [...project.brief.passages.values()].map((p) => `${p.address}\0${p.hash}`).sort();
  return [...files, ...receipts, ...decisions, ...brief].join('\n');
}

/**
 * Checks the options given (decisions.md §forma-decide) and, with `write`, writes each decision, holding the writer's lock.
 * Gives `{ refused }`, or with `write` `{ refused: [], recorded, written, removed }`.
 */
async function record(root, a, kind, ons, showing, given, { terminal, asked, fromText, now, write }) {
  const { project, design } = a;
  const r = project.restatement;
  const refused = [];
  const fail = (says, check = 'decisions.md §forma-decide', field = null) => refused.push(reason(check, says, { field }));

  // The name and the declared session (decisions.md §who-decides).
  const by = given.get('--by');
  if (blank(by)) fail('a decision records the name its maker gives, --by', 'decisions.md §who-decides', 'By');
  const parts = SESSION.filter((o) => given.has(o));
  let session = null;
  if (parts.length && parts.length < 3) fail('a session is declared whole: --provider, --model and --session together', 'decisions.md §who-decides', 'Session');
  else if (parts.length === 3) {
    session = { provider: given.get('--provider'), model: given.get('--model'), session: given.get('--session') };
    if (Object.values(session).some(blank)) fail('a declared session names a provider, a model and a session', 'decisions.md §who-decides', 'Session');
  } else if (!terminal) fail('a decision made where standard input or output is not a terminal declares its session: --provider, --model and --session', 'decisions.md §who-decides', 'Session');
  if (session) {
    const seen = await sessionsSeen(root);
    const answered = [...project.sessions.answered, ...seen];
    if (answered.some((s) => sameSession(s, session))) fail(`the session ${session.provider} / ${session.model} / ${session.session} has submitted an answer, and a session that answers makes no decision`, 'decisions.md §who-decides', 'Session');
  }

  // The clock rule (door.md §clock).
  const ahead = aheadOfClock(project.clock.latest, now);
  if (ahead) fail(`${ahead.file} holds ${ahead.at}, more than a minute ahead of this machine's clock, ${now.toISOString()}`, 'door.md §clock');

  // The token (presentation.md §showings, decisions.md §forma-decide).
  if (kind !== 'intake' && kind !== 'allow' && !asked) {
    const token = given.get('--shown');
    if (blank(token)) fail('a decision given its choices takes the token forma show printed, --shown');
    else if (token !== showing.token) fail('the token given is not the one the showing now gives: what the decision is on has changed since it was shown, so show it again');
  }

  // The kind's own options (decisions.md §kinds, §intake to §redirect).
  const words = given.get('--words');
  const rows = [];
  let pinOverride = null;
  if (kind === 'intake' || kind === 'allow') {
    if (kind === 'intake') {
      const situation = given.get('--situation');
      if (!SITUATIONS.includes(situation)) fail(`the situation is one of ${SITUATIONS.join(', ')}`, 'decisions.md §intake', 'Situation');
      rows.push(['Situation', situation ?? '-']);
      if (blank(words)) fail('the intake\'s words say what is out of scope and why, --words', 'decisions.md §intake', 'Words');
    }
    for (const option of ALLOWANCE_OPTIONS) {
      const v = given.get(option) ?? '0';
      if (!whole(v)) fail(`${option} is a whole number, 0 or more`, 'decisions.md §intake', ROW_OF[option]);
      rows.push([ROW_OF[option], String(v)]);
    }
    const cadence = given.get('--cadence') ?? (kind === 'intake' ? 'span' : undefined);
    const cap = given.get('--inbox-cap') ?? (kind === 'intake' ? '7' : undefined);
    if (cadence !== undefined && !CADENCES.includes(cadence)) fail(`the cadence is one of ${CADENCES.join(', ')}`, 'decisions.md §intake', 'Cadence');
    if (cap !== undefined && !whole(cap)) fail('the inbox cap is a whole number, 0 or more', 'decisions.md §intake', 'Inbox cap');
    if (cadence !== undefined) rows.push(['Cadence', cadence]);
    if (cap !== undefined) rows.push(['Inbox cap', String(cap)]);
  }
  const choice = given.get('--choice');
  if (CHOICES[kind] && !CHOICES[kind].includes(choice)) fail(`a ${kind}'s choice is ${CHOICES[kind].join(' or ')}`, 'decisions.md §kinds', 'Choice');
  if (kind === 'pick' && CHOICES.pick.includes(choice)) {
    const found = pickBlocked(a, ons[0], choice);
    for (const f of found) fail(`with ${choice} picked, the lifecycle tool would find, on ${f.on}, ${f.says}`, 'decisions.md §pick');
    rows.push(['Choice', choice]);
  }
  if (kind === 'decline' && blank(words)) fail("a decline's words give its reason, --words", 'decisions.md §kinds', 'Words');
  if (kind === 'accept') {
    rows.push(['Choice', choice ?? '-']);
    if (choice === 'accept' && blank(words)) fail('an acceptance says why its risk is accepted without examination, --words', 'decisions.md §accept', 'Words');
    if (choice === 'withdraw' && given.has('--words')) fail('a withdrawal takes no words', 'decisions.md §kinds', 'Words');
  }
  let basis = '-';
  if (kind === 'carry') {
    basis = given.get('--basis') ?? '-';
    if (basis !== '-') {
      const claim = r.things.get(basis);
      if (!claim || claim.kind !== 'claims') fail(`a carry's basis is a claim, <part or span>/claims/<claim>, and ${basis} is none`, 'decisions.md §carry', 'Basis');
      else {
        const claimParts = r.thingParts.get(basis) ?? claim.parts;
        for (const rec of showing.records) {
          const own = premiseParts(a, rec.on);
          const shared = claimParts.filter((p) => own.includes(p));
          if (shared.length) fail(`${basis} is a claim of ${shared.join(', ')}, a part ${rec.on} belongs to, so it cannot be that carry's basis`, 'decisions.md §carry', 'Basis');
        }
      }
    }
    if (choice === 'withdraw' && given.has('--words')) fail('a withdrawal takes no words', 'decisions.md §kinds', 'Words');
    if (choice === 'carry') {
      const strikes = showing.records.every((x) => x.on.startsWith('strike:'));
      if (blank(words) && !strikes) fail("a carry's words hold the falsifier, --words", 'decisions.md §carry', 'Words');
    }
  }
  if (kind === 'rule') {
    const verdict = given.get('--verdict');
    const level = given.get('--level');
    const target = given.get('--target') ?? '-';
    if (!VERDICTS.includes(verdict)) fail(`the verdict is one of ${VERDICTS.join(', ')}`, 'decisions.md §rulings', 'Verdict');
    if (!LEVELS.includes(level)) fail(`the level is one of ${LEVELS.join(', ')}`, 'decisions.md §rulings', 'Level');
    if (blank(words)) fail("a ruling's words give the direction its repairs are given, --words", 'decisions.md §kinds', 'Words');
    let targetPin = '-';
    const rec = showing.records[0];
    if (verdict === 'real finding') {
      if (target === '-') fail('a real finding has a target: brief, a model\'s key, premise:<premise> or choice:<part>/<choice>', 'decisions.md §rulings', 'Target');
      else if (level === 'requirement' && target !== 'brief') fail('a real finding at level requirement targets the brief', 'decisions.md §rulings', 'Target');
      else if (target.startsWith('premise:')) {
        const premise = design.premises.find((p) => p.name === target.slice('premise:'.length));
        if (!premise || premise.kind === 'choice') fail(`no premise ${target.slice('premise:'.length)} stands for the ruling to target`, 'decisions.md §rulings', 'Target');
        else targetPin = premise.pin;
      } else if (target.startsWith('choice:')) {
        const entry = target.slice('choice:'.length).replace(/^([^/]+)\//, '$1/choices/');
        const pin = r.pins.entries.get(entry)?.pin;
        if (!pin || r.entries.get(entry)?.kind !== 'choices') fail(`no choice ${target.slice('choice:'.length)} stands for the ruling to target`, 'decisions.md §rulings', 'Target');
        else targetPin = pin;
      } else if (target !== 'brief' && !a.evidence.models.get(target)?.exists) fail(`the target ${target} is not brief, a model that stands, a premise or a choice`, 'decisions.md §rulings', 'Target');
    } else if (given.has('--target') && target !== '-') fail('only a real finding has a target', 'decisions.md §rulings', 'Target');
    if (verdict === 'property wrong' && !rec.ruled.some((s) => s.where?.thing?.kind === 'claims')) fail('property wrong sends its repair to a claim, and none of these surprises is on a claim', 'decisions.md §rulings', 'Verdict');
    rows.push(['Verdict', verdict ?? '-'], ['Level', level ?? '-'], ['Target', target], ['Target pin', targetPin], ['Basis', given.get('--basis') ?? '-']);
  }
  if (kind === 'redirect') {
    const claimOn = /\/claims\//.test(ons[0] ?? '');
    if (claimOn && blank(words)) fail("a redirect of a claim's sentence gives it, --words", 'decisions.md §redirect', 'Words');
    if (!claimOn && blank(fromText)) fail("a redirect adding a journey gives its page, --from <file>", 'decisions.md §redirect', 'Words');
  }
  if (kind === 'brief') {
    // For stated, the address of each brief passage that states the mechanism, one a line, each once and each of a
    // citable passage, which the showing computed with them checks; for accepted, why the difference is accepted (decisions.md §kinds, §rulings).
    if (choice === 'stated') {
      const why = statedWordsReason(words ?? '');
      if (why) fail(why, 'decisions.md §forma-decide', 'Words');
    }
    if (choice === 'accepted' && blank(words)) fail('an accepted brief decision says why the difference is accepted, --words', 'decisions.md §kinds', 'Words');
  }
  if (refused.length || !write) return { refused };

  // Write each decision in the folder decisions.md §filing gives, at one At later than every tracked time (decisions.md §decision-file; door.md §clock).
  const at = nextAt(project.clock.latest?.at ?? null, now);
  const recorded = [];
  const written = [];
  let removed = [];
  const sessionRows = session;
  if (kind === 'intake' || kind === 'allow') {
    // The intake and an allowance show only their own choices (presentation.md §showings): the showing is its rows, which its pin pins (decisions.md §kinds).
    const shown = [`${kind} ${kind}`, ...rows.map(([f, v]) => `${f}: ${v}`)].join('\n');
    const text = decisionText({ kind, on: kind, pin: sha256(`${shown}\n`), rows, session: sessionRows, by, at, words: kind === 'intake' ? words : undefined, shown });
    recorded.push(await writeDecision(root, 'design/decisions', text, kind, at));
    return { refused: [], recorded, written, removed };
  }
  for (const rec of showing.records) {
    const d = { kind, on: rec.on, pin: pinOverride ?? rec.pin, rows: [], session: sessionRows, by, at, shown: rec.shown };
    if (kind === 'pick') d.rows = [['Choice', choice]];
    if (kind === 'accept') { d.rows = [['Choice', choice]]; if (choice === 'accept') d.words = words; }
    if (kind === 'carry') {
      d.rows = [['Choice', choice], ['Basis', basis]];
      if (choice === 'carry') {
        const p = rec.premise;
        d.words = !blank(words) ? words : p?.kind === 'strike' ? strikeFalsifier(MENU_NAMES[p.item] ?? p.item, r.parts.get(p.part)?.boundary.find((b) => b.key === p.row)?.names ?? p.row) : words;
      }
    }
    if (kind === 'decline') d.words = words;
    if (kind === 'confirm' && rec.journey) d.journey = rec.journey;
    if (kind === 'rule') {
      d.rows = rows;
      d.words = words;
      d.surprises = rec.surprises;
      if (given.get('--verdict') === 'model wrong') d.kept = rec.kept.map((k) => (k.journey ? { surprise: k.surprise, journey: k.journey } : { surprise: k.surprise, notKept: k.notKept }));
    }
    if (kind === 'redirect') d.words = rec.words;
    if (kind === 'brief') {
      d.rows = [['Choice', choice]];
      d.words = choice === 'stated' ? rec.words : words;
    }
    const subject = kind === 'rule' ? rulingSubject(rec.subject.where) : null;
    // A brief decision is filed where its ruling is (decisions.md §filing, §rulings).
    const folder = decisionFolderFor(r, kind, rec.on, { subject, ruling: kind === 'brief' ? rec.ruling : null });
    const text = decisionText(d);
    const path = await writeDecision(root, folder, text, kind, at);
    recorded.push(path);
    if (kind === 'redirect') {
      const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/, '');
      for (const w of showing.writes ?? []) {
        const wfolder = w.path.slice(0, w.path.lastIndexOf('/'));
        await takeIn(root, wfolder, w.path.slice(wfolder.length + 1), Buffer.from(w.bytes), { at, decision: name });
        written.push(w.path);
      }
    }
  }
  // A ruling closes the surprises it names; Forma then removes each one's own files (decisions.md §rulings; evidence.md §at-ruling).
  if (kind === 'rule') removed = await removeClosed(await readProject(root), root);
  return { refused: [], recorded, written, removed };
}
