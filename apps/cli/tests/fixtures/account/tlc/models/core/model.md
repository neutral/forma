# Ticket model

| Field | Value |
| --- | --- |
| Engine | tlc |
| Parts | p |
| Entry | Ticket.tla |
| Type invariant | TypeOK |

## Bounds

| Bound | Value | Meaning |
| --- | --- | --- |
| constant Tickets | {ticket} | One ticket. |

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
| p/state | e \in Tickets | Phase(e) |
