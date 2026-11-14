# Tiny observer

| Field | Value |
| --- | --- |
| Engine | tlc |
| Parts | beta |
| Entry | Tiny.tla |
| Type invariant | TypeOK |

## Bounds

| Bound | Value | Meaning |
| --- | --- | --- |
| choose Pick | - | One number is chosen; the other numbers are not explored. |
| constraint | x <= N | Only values up to the limit are explored. |
| constant N | 2 | Two observation positions. |

## Actions

| Action | Operator | Parameters |
| --- | --- | --- |
| beta/observe | Observe | none |

## Misbehaviours

| Row | Item | Operator | Parameters |
| --- | --- | --- | --- |

## Phases

| Lifecycle | Over | Expression |
| --- | --- | --- |
