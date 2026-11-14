| Field | Value |
| --- | --- |
| Question | stock-to-cash/parts/accounts/claims/receipts-once/fault-clamp-excessive-amount.ddfdfd789339 |
| Basis | 7856d007b00f |
| Verdict | property wrong |
| Level | implementation |
| Weaker | none |

## Trace

The deliberately faulty payment behavior was not detected, so the supplied result has no failing journey. A separate diagnostic found this story: four cartons are received and released; Northline's order for two is recorded, confirmed, prepared and collected, then invoiced for £20. Finance submits a new £30 receipt against that £20 balance; £20 is recorded, balance and exposure become zero, and the reference is consumed, although the entire excessive application should have been refused.

## Failure shape

This is a lifecycle hole: an excessive application settles an unpaid invoice where refusal is required, consuming a reference that should remain available for a valid retry. Its accounting totals remain consistent with the substituted amount, hiding the wrong application. I use implementation for the translation of the confirmed requirement into its executable check; this deliberately injected behavior supplies no evidence of a defect in deployed software. The behavior is unwanted, and this fault surprise leaves no kept journey.

## Mechanism

Recommend repairing only the receipts-once encoding under a property-wrong ruling. The sentence and accounts brief already require excessive applications to change no balances, exposure or successful identity record and to leave unused references retryable. The normal ApplyReceipt guard enforces the submitted amount against the remaining balance. The fault removes that validation/application mechanism while retaining the existing-reference checks and the original Cmd payload; no other guard prevents a new excessive application to a positive issued balance.

The encoding instead takes a from db'.receiptAmount[p]. Clipping makes that stored amount positive and no greater than the old balance; balance, Paid and exposure then agree with it. The property never relates that amount to the submitted command. Commit retains the disagreement in observation, but TypeOK permits it and this encoding never reads it. Thus the fault is active and reachable, yet the property is too weak.

All six supplied run inputs match the surprise's basis, and item.json reports no differences. Forma's completed search found no violation across 2,304,345 distinct states, depth 24. In a private pinned-TLC experiment I retained the original property, all model and fault bytes, all 58 rows and all bounds, adding only an action property requiring a new excessive submitted receipt to preserve balances, exposure and receipt records. It failed after eight business steps, with TypeOK intact: receipt 1, invoice 1, submitted amount 3, stored amount 2, old balance/exposure 2 and new balance/exposure 0, in £10 units. The original command is observation'.raw = 10556160, with input and effect disagreements; CmdB decodes the submitted amount. Only the added property failed.

The repair should connect the claim's own acceptance, exact-amount, replay and refusal obligations to retained original input while preserving its existing conservation and immutability checks. Generic ObserverClean is not this claim, and conditioning on the real ApplyReceipt operator would exclude the very faulted steps to examine. The diagnostic isolates the missing excess-refusal obligation; it is neither a complete replacement encoding nor standing. It uses no extra premise or enlarged bound. Upstream stock/order steps were checked against the supplied model; their brief pages were not supplied for independent comparison. No weaker forms apply to this fault question.
