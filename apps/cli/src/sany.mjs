// What TLA+'s own parser, SANY, says about a module (engines.md §engine-text).
// Code reads no TLA+ itself; it reads SANY's exported semantic tree.

import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, mkdir, cp, writeFile, rm, readdir, readFile, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { toolchain } from './toolchain.mjs';
import { FORMA_VERSION } from './version.mjs';

const run = promisify(execFile);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// A result is kept under the SHA-256 of every file SANY reads, the pinned tla2tools, Forma's version
// and this file's own text, so it is used only when parsing again would give exactly the same
// (engines.md §engine-text).
const SELF = sha256(readFileSync(new URL(import.meta.url)));
const CACHE = join(tmpdir(), 'forma-cache');
// The parses under way in this process, by key.
const asked = new Map();
let jar = null;

// --- SANY's XML ------------------------------------------------------------------------------------

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** SANY's XML, which has no attributes, as nested `{ tag, children, text }` nodes. */
function tree(xml) {
  const top = { tag: null, children: [] };
  const stack = [top];
  for (const match of xml.slice(xml.indexOf('?>') + 2).matchAll(/<(\/?)([A-Za-z_][\w.-]*)\s*(\/?)>|([^<]+)/g)) {
    const node = stack[stack.length - 1];
    if (match[4] !== undefined) node.text = (node.text ?? '') + match[4].replace(/&(lt|gt|amp|quot|apos);/g, (_, name) => ENTITIES[name]);
    else if (match[1]) stack.pop();
    else {
      const opened = { tag: match[2], children: [] };
      node.children.push(opened);
      if (!match[3]) stack.push(opened);
    }
  }
  return top.children[0] ?? null;
}

const child = (node, tag) => node?.children.find((c) => c.tag === tag) ?? null;
const text = (node, tag) => child(node, tag)?.text ?? null;

function* descendants(node, tag) {
  for (const inner of node?.children ?? []) {
    if (inner.tag === tag) yield inner;
    yield* descendants(inner, tag);
  }
}

/**
 * What the semantic tree says: every module loaded; every user-defined operator with its arity,
 * level (0 constant, 1 state, 2 action, 3 temporal), module and the operators its definition
 * names; every constant and variable; and the root module's own top level (`root`).
 */
function read(xml) {
  const top = tree(xml);
  const nodes = new Map();
  for (const entry of child(top, 'context')?.children ?? []) nodes.set(text(entry, 'UID'), entry.children.find((c) => c.tag !== 'UID'));
  const target = (ref) => nodes.get(text(ref, 'UID')) ?? null;
  const name = (node) => text(node, 'uniquename');
  const moduleOf = (node) => text(child(node, 'location'), 'filename');
  const level = (node) => Number(text(node, 'level') ?? 0);
  // The outermost operator of an expression: a built-in's name, or a definition's or declaration's.
  const head = (expression) => {
    if (expression?.tag !== 'OpApplNode') return { name: null, kind: expression?.tag ?? null, operands: [] };
    const ref = child(expression, 'operator')?.children[0];
    return { name: name(target(ref)), kind: ref?.tag.replace(/Ref$/, '') ?? null, operands: child(expression, 'operands')?.children ?? [] };
  };
  const bodyOf = (node) => child(node, 'body')?.children[0] ?? null;
  // The definitions a definition names outside the sets its quantifiers range over: a bound's set is where a Fairness
  // term writes its row's domain, which models.md §slot-answer checks as the row writes it, so what that domain names is the row's.
  const refersOutsideBounds = (node) => {
    const found = new Set();
    const walk = (at) => {
      if (at.tag === 'UserDefinedOpKindRef') {
        const named = target(at);
        if (named?.tag === 'UserDefinedOpKind') found.add(name(named));
        return;
      }
      if (at.tag === 'boundSymbols') {
        for (const bound of at.children) for (const inner of bound.children) if (['FormalParamNodeRef', 'tuple'].includes(inner.tag)) walk(inner);
        return;
      }
      for (const inner of at.children) walk(inner);
    };
    for (const inner of node.children) walk(inner);
    return [...found];
  };
  const operator = (node) => {
    const op = { name: name(node), arity: Number(text(node, 'arity') ?? 0), level: level(node), module: moduleOf(node) };
    op.refers = [...new Set([...descendants(node, 'UserDefinedOpKindRef')].map((ref) => target(ref)).filter((n) => n?.tag === 'UserDefinedOpKind').map(name))];
    op.refersOutsideBounds = refersOutsideBounds(node);
    const outer = head(bodyOf(node));
    // A tuple's components, each the name of a bare declaration or null (engines.md §model-fields, `vars`).
    if (outer.kind === 'BuiltInKind' && outer.name === '$Tuple') op.tuple = outer.operands.map((item) => {
      const inner = head(item);
      return inner.kind === 'OpDeclNode' && !inner.operands.length ? inner.name : null;
    });
    return op;
  };
  // Where SANY says a node is: its module, and its first and last line and column, each from 1
  // and inclusive, so code takes a node's text from the module SANY read and reads no TLA+ itself.
  const locationOf = (node) => {
    const at = child(node, 'location');
    if (!at) return null;
    const span = (tag) => [Number(text(child(at, tag), 'begin')), Number(text(child(at, tag), 'end'))];
    return { module: text(at, 'filename'), line: span('line'), column: span('column') };
  };
  const conjunctsOf = (expression) => {
    const outer = head(expression);
    return outer.kind === 'BuiltInKind' && ['\\land', '$ConjList'].includes(outer.name) ? outer.operands.flatMap(conjunctsOf) : [expression];
  };
  // An operand as a bare name: a bound parameter's or a declaration's applied to nothing, or null.
  const bareName = (operand) => {
    const inner = head(operand);
    return ['FormalParamNode', 'OpDeclNode', 'UserDefinedOpKind'].includes(inner.kind) && !inner.operands.length ? inner.name : null;
  };
  // A quantifier's bounds: each with the names it binds, whether it binds a tuple, and its set's place and level.
  const boundsOf = (node) => (child(node, 'boundSymbols')?.children ?? []).map((bound) => {
    const set = bound.children.find((c) => !['FormalParamNodeRef', 'tuple'].includes(c.tag)) ?? null;
    return { names: bound.children.filter((c) => c.tag === 'FormalParamNodeRef').map((ref) => name(target(ref))), tuple: bound.children.some((c) => c.tag === 'tuple'), set: set && locationOf(set), level: set ? level(set) : null };
  });
  // Each conjunct of a definition's body as a term of a Fairness (engines.md §slot-forms): where it is; the
  // outermost operator of the term and, under a quantifier, of its body; a bounded \A's bounds;
  // and, for a WF_ or SF_ term, its subscript, the bounds of a bounded \E at the head of its
  // action, and the conjuncts of the action, or of that \E's body, each with its outermost
  // operator, level, place and arguments.
  const termsOf = (expression) => conjunctsOf(expression).map((term) => {
    const outer = head(term);
    const quantified = outer.kind === 'BuiltInKind' && outer.name === '$BoundedForall';
    const body = quantified ? outer.operands[0] : term;
    const inner = head(body);
    const found = { at: locationOf(term), head: outer.name ?? outer.kind, bounds: quantified ? boundsOf(term) : null, body: inner.name ?? inner.kind, fairness: null };
    if (inner.kind === 'BuiltInKind' && ['$WF', '$SF'].includes(inner.name)) {
      const [subscript, action] = inner.operands;
      const top = head(action);
      const exists = top.kind === 'BuiltInKind' && top.name === '$BoundedExists';
      found.fairness = {
        kind: inner.name.slice(1), subscript: bareName(subscript), exists: exists ? boundsOf(action) : null,
        action: action ? conjunctsOf(exists ? top.operands[0] : action).map((c) => {
          const op = head(c);
          return { name: op.name ?? op.kind, kind: op.kind, level: level(c), at: locationOf(c), args: op.operands.map((a) => ({ name: bareName(a), at: locationOf(a) })) };
        }) : [],
      };
    }
    return found;
  });
  const kind = (node) => {
    const k = Number(text(node, 'kind') ?? 0);
    return k === 2 ? 'constant' : k === 3 ? 'variable' : `kind ${k}`;
  };
  const declaration = (node) => ({ name: name(node), arity: Number(text(node, 'arity') ?? 0), kind: kind(node), module: moduleOf(node), level: level(node) });

  const all = [...nodes.values()].filter(Boolean);
  const rootName = text(top, 'RootModule');
  const module = all.find((n) => n.tag === 'ModuleNode' && name(n) === rootName);
  const scope = [];
  const declarations = [];
  const instances = [];
  const other = [];
  for (const item of module?.children ?? []) {
    if (item.tag === 'UserDefinedOpKindRef') scope.push(target(item));
    else if (item.tag === 'OpDeclNodeRef') declarations.push(declaration(target(item)));
    else if (item.tag === 'InstanceNode') instances.push({ module: text(item, 'module'), name: name(item), at: moduleOf(item) });
    else if (item.tag.endsWith('Ref')) other.push({ kind: item.tag.replace(/Ref$/, ''), at: moduleOf(target(item)) });
    else if (!['location', 'uniquename'].includes(item.tag)) other.push({ kind: item.tag, at: moduleOf(item) });
  }
  const own = (thing) => thing.at === rootName;
  return {
    modules: [...new Set(all.filter((n) => n.tag === 'ModuleNode').map(name))],
    operators: all.filter((n) => n.tag === 'UserDefinedOpKind').map(operator),
    declarations: all.filter((n) => n.tag === 'OpDeclNode').map(declaration),
    root: {
      name: rootName,
      // Every definition in scope at the top level: the root's own, and those of the modules it extends.
      scope: scope.filter(Boolean).map(operator),
      // The root's own top-level definitions: no LET definition, nor a named instance's N!Op; an
      // unnamed INSTANCE in the root brings its module's definitions here, and is in `instances`.
      definitions: scope.filter((n) => n && moduleOf(n) === rootName && !name(n).includes('!')).map((n) => ({ ...operator(n), terms: termsOf(bodyOf(n)) })),
      // Every constant and variable in scope, each with the module that declares it.
      declarations,
      instances: instances.filter(own).map(({ module: m, name: n }) => ({ module: m, name: n })),
      // Anything else the root itself holds, such as a THEOREM or an ASSUME.
      other: other.filter(own).map((o) => o.kind),
    },
  };
}

// --- Running SANY ------------------------------------------------------------------------------------

/**
 * Parses `moduleName` in a copy of `dir` with `extra` files added, and returns what SANY
 * reports: whether it parsed, its messages, and, when it did, what its semantic tree says (`read`).
 */
export async function sany(dir, moduleName, extra = {}) {
  const tools = await toolchain();
  const files = [];
  for (const name of (await readdir(dir)).sort()) if (name.endsWith('.tla') && !(name in extra)) files.push([name, sha256(await readFile(join(dir, name)))]);
  for (const [name, text] of Object.entries(extra).sort(([a], [b]) => (a < b ? -1 : 1))) files.push([name, sha256(text)]);
  jar ??= sha256(await readFile(tools.tla2tools));
  const key = sha256(JSON.stringify([FORMA_VERSION, SELF, jar, moduleName, files]));
  const cached = join(CACHE, `sany-${key}.json`);
  if (existsSync(cached)) return JSON.parse(await readFile(cached, 'utf8'));
  // Several parses run at once in one process: the same question asked twice is parsed once.
  if (!asked.has(key)) {
    asked.set(key, (async () => {
      const result = await parse(dir, moduleName, extra, tools);
      await mkdir(CACHE, { recursive: true });
      // Written aside, under a name no other write has, and renamed into place, so nobody reads it half written.
      const aside = `${cached}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(aside, JSON.stringify(result));
      await rename(aside, cached);
      return result;
    })().finally(() => asked.delete(key)));
  }
  return asked.get(key);
}

/** SANY's own words, without its progress lines, its Java stack traces or its warnings. */
function said(output) {
  const lines = output.split('\n').filter((l) => l && !/^(Parsing|Semantic processing)/.test(l)).join(' ');
  const cut = lines.search(/failed for node\.toString\(\)|Exception in thread|\tat |\*\*\* Warnings/);
  return (cut === -1 ? lines : lines.slice(0, cut)).replace(/\s+/g, ' ').trim();
}

async function parse(dir, moduleName, extra, tools) {
  const work = await mkdtemp(join(tmpdir(), 'forma-sany-'));
  try {
    for (const name of await readdir(dir)) if (name.endsWith('.tla')) await cp(join(dir, name), join(work, name));
    for (const [name, text] of Object.entries(extra)) await writeFile(join(work, name), text);
    // Each JVM unpacks the standard modules into its own folder; a shared one races between processes.
    const own = join(work, '.java-tmp');
    await mkdir(own);
    const java = async (main) => {
      try {
        return { exited: true, ...(await run(tools.java, [`-Djava.io.tmpdir=${own}`, '-cp', tools.tla2tools, main, ...(main.endsWith('XMLExporter') ? ['-o'] : []), `${moduleName}.tla`], { cwd: work, maxBuffer: 64 * 1024 * 1024 })) };
      } catch (error) {
        return { exited: false, stdout: error.stdout ?? '', stderr: error.stderr ?? error.message };
      }
    };
    const { exited, stdout, stderr } = await java('tla2sany.xml.XMLExporter');
    const start = stdout.indexOf('<?xml');
    const before = `${start === -1 ? stdout : stdout.slice(0, start)}\n${stderr}`;
    // A semantic or level error is a refusal even when the exporter exits 0 and writes its XML.
    if (!exited || start === -1 || /\*\*\* Errors: [1-9]/.test(before)) {
      let message = said(before);
      // The exporter does not say where a module fails to parse; SANY itself does.
      if (/Could not parse module/.test(message)) {
        const plain = await java('tla2sany.SANY');
        const where = /(\*\*\*\s*Parse Error\s*\*\*\*|Lexical error at)[\s\S]*?(?=Residual stack trace|Fatal errors|$)/i.exec(`${plain.stdout}\n${plain.stderr}`)?.[0];
        if (where) message = `${said(where)} ${message}`;
      }
      return { ok: false, messages: [message] };
    }
    return { ok: true, messages: [], ...read(stdout.slice(start)) };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
