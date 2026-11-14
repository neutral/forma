// The developer's decisions (presentation.md §showings to decisions.md §forma-decide): `forma show` and `forma decide`. Each command
// returns `{ status, stdout, stderr }`; ../cli.mjs prints and exits.

export { showCommand } from './show.mjs';
export { decideCommand } from './decide.mjs';
