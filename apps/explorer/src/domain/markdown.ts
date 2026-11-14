// A passage as written (presentation.md §explorer, "The document"): its Markdown rendered with raw HTML
// disabled, and each link to another of the brief's documents moved to that document on the page.
import MarkdownIt from 'markdown-it';

/** Where a link to one of the brief's documents lands on the page: a section id, or null to leave it. */
type Landing = (file: string, fragment: string | null) => string | null;

type Env = { from: string; landing: Landing };

const md = new MarkdownIt({ html: false, linkify: false });

md.renderer.rules.link_open = (tokens, idx, options, env: Env, self) => {
  const token = tokens[idx];
  const link = token ? documentLink(token.attrGet('href'), env.from) : null;
  const section = link ? env.landing(link.file, link.fragment) : null;
  if (token && section) token.attrSet('href', `#${section}`);
  return self.renderToken(tokens, idx, options);
};

export function passageHtml(text: string, from: string, landing: Landing): string {
  return md.render(text, { from, landing } satisfies Env);
}

/** The brief's documents a text links to, in the order of its links, each once. */
export function linkedDocuments(text: string, from: string): string[] {
  const files: string[] = [];
  const visit = (tokens: ReturnType<typeof md.parse>) => {
    for (const token of tokens) {
      if (token.type === 'link_open') {
        const file = documentLink(token.attrGet('href'), from)?.file;
        if (file && !files.includes(file)) files.push(file);
      }
      if (token.children) visit(token.children);
    }
  };
  visit(md.parse(text, {}));
  return files;
}

/** A relative link to a Markdown document, resolved against the linking document's folder. */
function documentLink(href: string | null, from: string): { file: string; fragment: string | null } | null {
  const m = /^([^:#]+\.md)(#.*)?$/.exec(href ?? '');
  if (!m?.[1]) return null;
  return { file: resolve(dirname(from), decode(m[1])), fragment: m[2] ? decode(m[2]) : null };
}

const dirname = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')));

function resolve(dir: string, relative: string): string {
  const parts: string[] = [];
  for (const part of `${dir}/${relative}`.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

function decode(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}
