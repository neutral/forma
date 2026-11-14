# Ticket model

| Field | Value |
| --- | --- |
| Engine | alloy |
| Parts | p |
| Entry | Ticket.als |
| Type invariant | - |

## Bounds

| Bound | Value | Meaning |
| --- | --- | --- |
| scope | 2 | Two atoms per unconstrained signature. |
| steps | 3 | Three transition states. |

## Actions

| Action | Operator | Parameters |
| --- | --- | --- |
| p/finish | Finish | none |

## Misbehaviours

| Row | Item | Operator | Parameters |
| --- | --- | --- | --- |

## Phases

| Lifecycle | Over | Expression |
| --- | --- | --- |
| p/state | e: Ticket | e.phase |
