# Carry premises and accept risk

A claim is established only when every premise it rests on is carried: what no
run examines is your decision
([account.md §standing](../../spec/account.md#standing)). The premises a claim
rests on, on a model, are:

- each premise its page names under `Rests on`: a premise page, a store premise
  `store:<part>/<row>`, or a choice's premise, which its pick carries;
- its bounds on that model, `bound:<model>/<part or span>/<claim>`;
- every strike in force on a world row of the model's parts.

`forma missing` lists each one not carried as `carry:<premise>`, but a choice's
premise, which its pick carries: that one shows as `pick:`.

## Carry a premise

1. Show it:

   ```bash
   forma show carry orders/premises/atomic-payment
   ```

   You see it in your terms, with the passages it cites. `forma account` lists,
   under each premise, the claims that rest on it.

2. Carry it with its falsifier, the observation that would show it false:

   ```bash
   forma decide carry orders/premises/atomic-payment --choice carry --shown <token> \
     --words "A payment recorded without its order marked paid, in the store's history." --by "Your Name"
   ```

The premises code adds are carried the same way:

| Premise | Is |
| --- | --- |
| `store:<part>/<row>` | what a store's isolation permits |
| `bound:<model>/<part or span>/<claim>` | that the claim holds beyond its bounds on that model |

`bound:<model>` alone names the bounds of every claim on that model waiting for
a carry, in one showing. A carry may name as its basis, with `--basis`, a claim
none of whose `Parts` is a part the premise belongs to: its own part, its row's
part, for bounds the claim's parts, for a span both parts. It counts only while
that claim is established without it. A choice's premise is carried by its
pick, never by a carry. Withdraw a carry with `--choice withdraw`.

## Strike a misbehaviour

Every boundary row on the world's side of kind actor, service, queue or clock,
something outside your design that it deals with, may do each misbehaviour on
the menu, such as `crash` or `go-silent`
([forms.md §menu](../../spec/forms.md#menu)), and the models examine the claims
against all of them. When a row cannot do one in your setting, strike it: no
question then rests on that misbehaviour, and every claim on a model of that
part rests on the strike, which the box shows with its falsifier. No item asks
for a strike; you make it when you know it holds.

1. Show it:

   ```bash
   forma show carry strike:orders/payments/go-silent
   ```

2. Carry it:

   ```bash
   forma decide carry strike:orders/payments/go-silent --choice carry \
     --shown <token> --by "Your Name"
   ```

Forma writes the falsifier, as `an observed go silent mid-step at <the row's
names>`, the misbehaviour named as the menu names it; give `--words` to say it
in your terms. Striking, or withdrawing a strike, changes how every question on
each TLC or Alloy model covering the row's part is composed: all its evidence
goes not current, and each question is owed a run that spends. A strike made
after a model was accepted leaves that model's row as it is. Withdrawing a
strike restores the misbehaviour; a TLC model accepted while the strike was in
force is then owed a Model answer.

## Carry a span

Two parts form a span when one emits an event the other consumes, or both
read, write or call the same boundary row. When no claim or journey of both
parts is examined on a model covering both, `forma missing` lists it as
`span:<part>+<part>`, for an agent to supply that claim or journey, or that
model, or for you to carry that the parts hold together unexamined
([forms.md §surface](../../spec/forms.md#surface)).

1. Show it:

   ```bash
   forma show carry span:orders+payments
   ```

2. Carry it with its falsifier:

   ```bash
   forma decide carry span:orders+payments --choice carry --shown <token> \
     --words "An order shown paid whose payment the payments service has no record of." --by "Your Name"
   ```

## Accept a claim's risk

When a claim cannot be examined, or is not worth the cost, accept its risk.

1. Show it:

   ```bash
   forma show accept orders/claims/<claim>
   ```

2. Accept it, saying why the risk is accepted without examination:

   ```bash
   forma decide accept orders/claims/<claim> --choice accept --shown <token> \
     --words "A double charge is refunded by hand within a day; examining it is not worth the cost." \
     --by "Your Name"
   ```

While it is not established, the claim then reads `accepted`, and enters the box
marked as accepted and not examined, once the premises its page names are all
carried. A claim established on some model reads `established` whatever you
accepted. Withdraw an acceptance with `--choice withdraw`.
