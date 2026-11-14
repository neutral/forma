// The command line (project.md §explore): `forma-explorer serve [--project <folder>] [--port <port>]`
// and `forma-explorer export [--project <folder>] <folder>`, options before or after the command. Every
// refusal is read at once: an unknown command or option, an option given twice or without its value,
// an invalid port, and an argument the command does not take.

const USAGE = {
  serve: 'forma-explorer serve [--project <folder>] [--port <port>]',
  export: 'forma-explorer export [--project <folder>] <folder>',
} as const;
type Name = keyof typeof USAGE;
const OPTIONS: Record<Name, readonly string[]> = { serve: ['--project', '--port'], export: ['--project'] };
const KNOWN = new Set(Object.values(OPTIONS).flat());

type Command =
  | { command: 'serve'; project: string | null; port: number }
  | { command: 'export'; project: string | null; destination: string };

const isName = (token: string): token is Name => Object.hasOwn(USAGE, token);
const quoted = (tokens: string[]) => tokens.map((token) => `"${token}"`).join(' ');

/** The command a line asks for, or every reason it is refused. */
export function parseLine(args: readonly string[]): Command | { refused: string[] } {
  const refused: string[] = [];
  const values = new Map<string, string>();
  const seen = new Set<string>();
  const positional: string[] = [];
  let command: Name | null = null;
  for (let at = 0; at < args.length; at += 1) {
    const token = args[at] ?? '';
    if (token.startsWith('--')) {
      if (!KNOWN.has(token)) {
        refused.push(`${token} is no option forma-explorer knows: ${command ? USAGE[command] : `${USAGE.serve}, or ${USAGE.export}`}`);
        continue;
      }
      if (seen.has(token)) refused.push(`the option ${token} is given twice; give it once`);
      seen.add(token);
      const value = args[at + 1];
      if (value === undefined || value.startsWith('--')) {
        refused.push(`the option ${token} is given without its value: ${token === '--port' ? '--port <port>' : '--project <folder>'}`);
        continue;
      }
      values.set(token, value);
      at += 1;
    } else if (command) positional.push(token);
    else if (isName(token)) command = token;
    else {
      refused.push(`${token} is no command forma-explorer knows; the commands are serve and export`);
      return { refused };
    }
  }
  if (!command) return { refused: [...refused, `no command is given: ${USAGE.serve}, or ${USAGE.export}`] };
  for (const option of seen)
    if (!OPTIONS[command].includes(option)) refused.push(`${option} is no option of forma-explorer ${command}: ${USAGE[command]}`);
  const project = values.get('--project') ?? null;
  if (command === 'serve') {
    const port = values.get('--port');
    if (port !== undefined && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535))
      refused.push('--port must be an integer from 1 to 65535');
    if (positional.length) refused.push(`forma-explorer serve takes no argument, and was given ${quoted(positional)}: ${USAGE.serve}`);
    return refused.length ? { refused } : { command, project, port: port === undefined ? 0 : Number(port) };
  }
  const [destination, ...more] = positional;
  if (destination === undefined) return { refused: [...refused, `forma-explorer export names the folder to write to: ${USAGE.export}`] };
  if (more.length) refused.push(`forma-explorer export takes one folder, and was given ${quoted(positional)}: ${USAGE.export}`);
  return refused.length ? { refused } : { command, project, destination };
}
