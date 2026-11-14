// Concrete lifecycle moves shared by the engine and the picture
// (lifecycle-tool.md §as-read; engines.md §lifecycle-engine). No project IO.
import { createHash } from 'node:crypto';

export const lifecycleId = (kind, ...parts) =>
  `${kind}_${createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 24)}`;

export function lifecycleConfiguration(lifecycle) {
  const identity = lifecycle.entry ?? lifecycle.key;
  const cells = lifecycle.asRead ?? lifecycle.cells;
  const stateKeys = Object.fromEntries(
    lifecycle.phases.map((phase) => [phase, lifecycleId('phase', identity, phase)]),
  );
  const mapping = { states: {}, events: {}, cells: {} };
  const states = {};
  const moves = [];
  for (const phase of lifecycle.phases) {
    const id = stateKeys[phase];
    mapping.states[id] = phase;
    const on = {};
    for (const action of lifecycle.actions) {
      const cell = cells?.[phase]?.[action];
      const cases = cell?.kind === 'cases' ? cell.cases : [{ case: null, outcome: cell }];
      for (const row of cases) {
        const cellId = lifecycleId('cell', identity, phase, action, row.case ?? null);
        const event = lifecycleId('event', action, row.case ?? null);
        mapping.events[event] = { action, case: row.case ?? null };
        mapping.cells[cellId] = { phase, action, case: row.case ?? null };
        if (row.outcome?.kind !== 'phase' || !stateKeys[row.outcome.phase]) continue;
        on[event] = { target: `#${stateKeys[row.outcome.phase]}` };
        moves.push({
          id: lifecycleId('move', identity, phase, action, row.case ?? null),
          from: phase,
          to: row.outcome.phase,
          action,
          case: row.case ?? null,
          cell: cellId,
          steps: [],
        });
      }
    }
    states[id] = { id, on };
  }
  return {
    machine: {
      id: lifecycleId('lifecycle', identity),
      initial: stateKeys[lifecycle.initial?.phase],
      states,
    },
    mapping,
    stateKeys,
    moves,
  };
}
