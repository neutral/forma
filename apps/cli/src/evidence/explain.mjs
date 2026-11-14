// The Explain answer's checks (evidence.md §explain): explain.md's form, the open surprise it names, and
// its weaker forms, each put to models.md §slot-answer's checks of an encoding's text for that claim on that
// model. A pure function: it writes nothing, and gives what the door (../door/answer.mjs) takes in, with receipts.

import { EXTENSION, slotReasons } from '../record/models.mjs';
import { basisDigest } from '../record/json.mjs';
import { parseExplain, stemFiles } from '../record/evidence.mjs';
import { isKey } from '../record/tree.mjs';

const reason = (file, says, field = null, entry = null, check = 'evidence.md §explain') => ({ check, file, entry, field, says });

/**
 * Checks an Explain answer (evidence.md §explain) after the door's own checks: `answer` maps each file's path in the answer
 * folder to its bytes. Gives `{ refused: [reasons] }`, each in door.md §forma-answer's form, every check that fails named; or
 * `{ writes: [{ path, bytes }] }`, paths from the project folder: explain.md as `<stem>.explained.md` and each weaker
 * form as `<stem>.weaker-<key>.<ext>` beside the surprise (evidence.md §stems). `evidence` is evidence/index.mjs's readEvidence.
 */
export async function checkExplain(project, design, evidence, answer) {
  const refused = [];
  const text = answer.get('explain.md');
  // Check 1: explain.md in its form, nothing else but weaker forms, Weaker naming each once and nothing else.
  if (text === undefined) return { refused: [reason('explain.md', 'the answer holds no explain.md')] };
  const { explanation, reasons } = parseExplain(Buffer.from(text).toString('utf8'), 'explain.md');
  refused.push(...reasons);
  const weaker = new Map();
  for (const path of [...answer.keys()].sort()) {
    if (path === 'explain.md') continue;
    const m = /^weaker\/([^/]+)\.([a-z]+)$/.exec(path);
    if (!m || !isKey(m[1])) { refused.push(reason(path, 'an Explain answer holds explain.md and weaker forms, each weaker/<key>.<ext>, and nothing else')); continue; }
    if (weaker.has(m[1])) { refused.push(reason(path, `the weaker form ${m[1]} is given twice`)); continue; }
    weaker.set(m[1], { path, extension: m[2], bytes: answer.get(path) });
  }
  for (const key of explanation.weaker) if (!weaker.has(key)) refused.push(reason('explain.md', `Weaker names ${key}, and the answer holds no weaker/${key}.<ext>`, 'Weaker'));
  for (const [key, form] of weaker) if (!explanation.weaker.includes(key)) refused.push(reason(form.path, `Weaker does not name ${key}`, 'Weaker'));
  // Check 2: Question and Basis name an open surprise with no accepted explanation.
  const surprise = evidence.surprises.find((s) => s.question === explanation.question && basisDigest(s.value.basis).slice(0, 12) === explanation.basis);
  if (!surprise) {
    refused.push(reason('explain.md', `no surprise of the question ${explanation.question || '(none given)'} has a basis digest beginning ${explanation.basis || '(none given)'}`, 'Question'));
    return { refused };
  }
  if (!surprise.open) refused.push(reason('explain.md', `the surprise ${surprise.name} is ruled, by ${surprise.ruledBy}, and is no longer explained`, 'Question'));
  if (surprise.explained) refused.push(reason('explain.md', `the surprise ${surprise.name} has an accepted explanation already, ${surprise.explanation.path}`, 'Question'));
  // Check 3: weaker forms for a surprise on a base question of a TLC or Alloy model that found a violation of the
  // encoding's own property, at least one, and for no other: a type invariant violated first fails every weaker form alike.
  const state = evidence.models.get(surprise.model);
  const engine = state?.model?.engine ?? state?.engine;
  const own = { tlc: ['Invariant', 'Property'], alloy: ['Claim'] }[engine] ?? [];
  const found = surprise.value.found;
  const takes = surprise.where.question.kind === 'base' && engine !== 'lifecycle' && found?.outcome === 'violation' && own.includes(found.property);
  const entry = surprise.where.thing?.kind === 'claims' ? `${surprise.where.holder.key}/claims/${surprise.where.thing.key}` : null;
  if (takes && !weaker.size) refused.push(reason('explain.md', "a surprise on a base question of a TLC or Alloy model that found a violation of the encoding's own property is explained with at least one weaker form of its claim, from the strongest to the weakest", 'Weaker', entry));
  if (!takes && weaker.size) refused.push(reason('explain.md', `only a surprise on a base question of a TLC or Alloy model that found a violation of the encoding's own property is explained with weaker forms, and this one found ${found?.outcome === 'violation' ? `a violation of ${found.property}` : found?.outcome ?? 'nothing'}${surprise.where.question.kind === 'base' ? '' : ` on a ${surprise.where.question.kind} question`}: a type invariant violated first fails every weaker form alike`, 'Weaker', entry));
  if (takes && state?.model) {
    const claim = project.restatement.things.get(entry);
    const extension = EXTENSION[state.model.engine];
    for (const [key, form] of weaker) {
      if (form.extension !== extension) { refused.push(reason(form.path, `a weaker form has the extension of the claim's encoding on the model ${surprise.model}, .${extension}`, null, entry)); continue; }
      if (!claim) { refused.push(reason(form.path, `the claim ${entry} counts for nothing or stands nowhere, so its weaker form cannot be checked`, null, entry)); continue; }
      const found = await slotReasons({ kind: 'encoding', extension, path: form.path }, Buffer.from(form.bytes).toString('utf8'), { model: state.model, files: state.files, restatement: project.restatement, claim });
      refused.push(...found.map((r) => ({ ...r, file: form.path, says: `the weaker form ${key}: ${r.says}` })));
    }
  }
  if (refused.length) return { refused };
  return {
    writes: [
      { path: stemFiles.explanation(surprise.name), bytes: Buffer.from(text) },
      ...[...weaker].map(([key, form]) => ({ path: stemFiles.weaker(surprise.name, key, form.extension), bytes: Buffer.from(form.bytes) })),
    ],
  };
}
