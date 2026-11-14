# The box

The box is what leaves Forma. `forma box` prints it, under the heading
`What the software may be said to guarantee`
([account.md §box](../../spec/account.md#box)). It holds only:

- each established claim, with the bounds it holds within on each model and the
  premises it rests on there;
- each claim whose risk you accepted and that is not established, once the
  premises its page names are carried, marked accepted and not examined;
- each carried premise, with its falsifier, the observation that would show it
  false;
- under each established claim, every mechanism a real-finding repair added to
  a model it is established on, and whether the brief states it;
- the sentences of what the account cannot know.

Nothing else enters it. A claim resting on a premise you have not carried is not
in the box, however its runs went.

## Why the box names the mechanisms

When you rule a surprise a real finding and send its repair to a model, the
model gains a mechanism the brief does not describe: a recheck, a guard, a
stored key. The claims then hold of the repaired model, not of the design the
brief states. So the box names each such mechanism under each claim, with one of:

- *the brief states it*, once you have decided so, naming the passages;
- *not in the brief, accepted*, once you have accepted the difference, with why;
- *not in the brief*, until you decide.

That is the `brief` decision
([decisions.md §rulings](../../spec/decisions.md#rulings)). Without it, a claim
would leave Forma as if it held of a design nobody wrote down.

## What it never says

Forma's own words use "guarantee" only in the box's heading; your names and
sentences are shown as you wrote them. A claim holds within its bounds, on its
model, given its carried premises, and the box says each of those. It never
says the code you will write behaves so: the model is the design, not the
implementation.
