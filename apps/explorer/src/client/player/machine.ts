// Stepping a scenario's lit walk on its drawing: the step the reader stands at, from 0 (the start) to the
// last. It starts at the last, the whole walk lit as the reading gives it.
import { assign, setup } from 'xstate';

const BEAT_MS = 900;

export const player = setup({
  types: {
    context: {} as { at: number; last: number },
    input: {} as { last: number },
    events: {} as { type: 'next' } | { type: 'previous' } | { type: 'play' } | { type: 'pause' } | { type: 'reset' },
  },
  actions: {
    next: assign({ at: ({ context }) => Math.min(context.at + 1, context.last) }),
    previous: assign({ at: ({ context }) => Math.max(context.at - 1, 0) }),
    reset: assign({ at: 0 }),
    /** Play from the start when the walk is already whole. */
    rewindAtEnd: assign({ at: ({ context }) => (context.at >= context.last ? 0 : context.at) }),
  },
  guards: {
    atEnd: ({ context }) => context.at >= context.last,
  },
  delays: {
    beat: BEAT_MS,
  },
}).createMachine({
  id: 'player',
  context: ({ input }) => ({ at: input.last, last: input.last }),
  initial: 'paused',
  states: {
    paused: {
      on: {
        next: { actions: 'next' },
        previous: { actions: 'previous' },
        reset: { actions: 'reset' },
        play: { target: 'playing', actions: 'rewindAtEnd' },
      },
    },
    playing: {
      always: { guard: 'atEnd', target: 'paused' },
      after: { beat: { target: 'playing', reenter: true, actions: 'next' } },
      on: {
        pause: 'paused',
        reset: { target: 'paused', actions: 'reset' },
        next: { target: 'paused', actions: 'next' },
        previous: { target: 'paused', actions: 'previous' },
      },
    },
  },
});
