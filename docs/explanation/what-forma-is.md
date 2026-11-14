# What Forma is for, and what it cannot know

Agents can write the models of a design. They cannot be the ones to say what
the models showed. So in Forma an agent proposes, and nothing rests on its
word:

- **The design stays yours.** You write the brief in your own terms, and every
  claim, journey and premise an agent restates from it cites the passages it
  came from. No entry of the restatement counts toward standing until you
  confirm it.
- **An agent's work is checked or refused.** It enters the record through
  `forma answer`, and the runs it is scoped to make. Every answer is checked
  against the contracts and taken in with a receipt, or refused with every
  reason.
- **A result says what it is.** A claim is established only when you confirmed
  it, its property held within the bounds, a planted fault was caught, every
  witness was reached, the journeys you confirmed conform, its premises are
  carried, and no surprise is open on its model. An engine that ran out of time
  or memory has not answered; sampled search establishes nothing.
- **The account is computed, never stored.** It is a function of the tracked
  files and of the engine, runtime and Forma versions where it is computed.
  Delete the scratch folders and it says the same; run the engines twice and no
  tracked byte changes.

## What Forma cannot know

Forma checks that an encoding holds of a model. It cannot check that the model
is faithful to your design, or that the claim you confirmed is the one you
needed. Choosing the right specification is yours: formal methods are no
answer to it. Forma narrows the gap three ways:

- the journeys you confirm must happen, or be refused, on every model covering
  their parts before its claims count, so a model that cannot do what you said
  it should is caught;
- on TLC and Alloy, a should-happen journey's expected end is checked after its
  last step;
- every trace a result keeps, a surprise's, a reduction's, a witness reached, is
  shown back to you as a journey in your own terms, lit on the lifecycles you
  confirmed.

The account ends with the sentences of what it cannot know
([account.md §cannot-know](../../spec/account.md#cannot-know)), and the box
carries them too.

## How the work flows

1. You write the brief and make the intake: the situation, and how much work
   and engine time you allow.
2. Agents restate the brief into pages; you confirm them.
3. Agents write a model and fill its slots: each claim's encoding, witnesses and
   faults, and each journey's schedule.
4. `forma run` asks every question that is owed and writes one evidence file
   per question.
5. What surprised a question is explained by an agent that did not write the
   model, and you rule on it. The ruling sends a repair to its target.
6. You carry the premises the claims rest on. The box then holds what may be
   said to hold.

`forma missing` lists, at every point, the work still owed, who supplies it and
what it waits for.
