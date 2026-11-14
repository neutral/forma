# Coil & Clip stock to cash

| Field | Value |
| --- | --- |
| Engine | tlc |
| Parts | stock, orders, accounts |
| Entry | StockToCash.tla |
| Type invariant | TypeOK |

## Bounds

| Bound | Value | Meaning |
| --- | --- | --- |
| constant Hazards | 1..8 | At most one exceptional incident is examined per execution: one lost post-commit reply, one duplicate of a sampled command, one delayed reply, one later reply arriving before a delayed earlier reply, permanent refusal, transient failure followed by a later business retry, actor crash, or silence after a commit. The selected actor first samples at most its first two successful command inputs, retaining every original field independently of mutable ERP records; these are the volatile request/reply samples exposed to the incident. Thereafter ordinary business commands and retries continue without a step bound; a delayed reply may arrive after any number of intervening commits. Completed auxiliary observations are discarded when no future transition needs them, while pending payloads and blocked actors remain. Multiple incident types in one execution, repeated independent incidents, faults affecting commands after those two samples, and a restart after crash are excluded. |
| constant Profiles | 1..5 | The examination has five input families, no step horizon and every action ordering: (1) one four-carton batch, two Northline orders of two cartons, Northline limit twenty pounds; (2) one two-carton batch, a two-carton order for each of Northline and Pinpoint, limits one hundred pounds; (3) one four-carton batch, Northline order four and Pinpoint order two, limits one hundred pounds; (4) batches of cartons 1-2 and 3-4, Northline order four and Pinpoint order two, limits one hundred pounds, with batch 2 also allowed to contend for cartons 1-2; (5) one four-carton batch, Northline order three at limit twenty pounds and Pinpoint order five at limit one hundred pounds. Customer 1 is Northline, customer 2 Pinpoint. Initial order inputs are fixed by these families; recorded identities admit every conflicting input for retry checks. Reservation requests use sets 1-2, 3-4, 1-3 or all four; preparation uses sets 1-2, 3-4 or all four. Two-carton partial shipments and one-unit partial payments remain possible. Other initial input combinations, zero-quantity first orders, empty, singleton and three-carton first preparations, and cross-family executions are outside the examination. |
| constant Batches | 1..2 | Two batch identities; more batches are outside this examination. |
| constant Cartons | 1..4 | Four individually identified cartons, with request memberships restricted by the five input families; five-carton stock and larger warehouses are outside this examination. |
| constant Customers | 1..2 | Two customers, so orders can compete either on one credit account or across accounts. |
| constant Orders | 1..2 | Two order identities, including exact retries and conflicting identity reuse; a third distinct order is outside this examination. |
| constant Shipments | 1..2 | Two shipment identities. First preparation of shipment 1 names order 1 and cartons 1-2 or all four; shipment 2 names order 1 with cartons 3-4, or order 2 with either pair or all four. A used identity admits every conflicting order and carton set, plus exact replays after collection or voiding. Other first-use identity assignments are excluded; all preparation and collection orderings remain possible. |
| constant Receipts | 1..3 | Three receipt references: first use of receipts 1 and 2 names invoice 1, and first use of receipt 3 names invoice 2, each with every amount from zero through five ten-pound units. A used reference admits both invoice identities and every bounded amount for conflict and replay checks. Invoice 1 can be partially paid then settled; invoice 2 has at most one fresh receipt. Other first-use assignments and a fourth receipt are excluded. |
| constant Decisions | 1..4 | Four QA identities with explicit first-use inputs. Single-batch families use release 1 at revision 0, hold 2 at revision 0 or 1, release 3 at revision 1 or 2, hold 4 at revision 2 or 3. The two-batch family uses release 1 on batch 1 at revision 0, release 2 on batch 2 at revision 0, hold 3 on either batch at revision 0 or 1, release 4 on either batch at revision 1 or 2. Inspection can be complete or incomplete. These include stale attempts and allow both batches released and one held then freshly released. A used identity admits all conflicting fields and exact replays. Other first-use identity assignments and a fifth QA decision are excluded. |
| constant MaxQuantity | 5 | Requests carry zero through five cartons or ten-pound payment units; includes positive quantities above four-carton stock, zero payments and overpayments. Larger quantities, nonintegral quantities and amounts not divisible by ten pounds are outside this examination. |
| constant LimitValues | {2,10} | The input families use immutable credit limits of twenty or one hundred pounds with zero opening exposure; other limits, combinations and opening balances are outside this examination. |
| constant Focuses | 0..6 | Each execution singles out at most one person whose requests or replies may fail: zero none, one QA, two sales, three picker, four customer, five carrier, six finance. All active people retain arbitrary business requests and retries. Simultaneous independent failures of several people are excluded. One delayed reply and one duplicate request are retained, from the first two successful command samples; a crash loses this volatile state and has no restart action. No fairness or eventual action is assumed. |
| choose SumOn | - | Summation selects a member only to traverse a finite set; integer addition is commutative, so this leaves out no allocation, customer, request or action choice. |

## Actions

| Action | Operator | Parameters |
| --- | --- | --- |
| stock/receive-batch | ReceiveBatchRequest | request \in BatchRequests |
| stock/release-batch | ReleaseBatchRequest | request \in ReleaseRequests |
| stock/hold-batch | HoldBatchRequest | request \in HoldRequests |
| orders/record-order | RecordOrderRequest | request \in OrderRequests |
| orders/confirm-order | ConfirmOrderRequest | request \in ConfirmationRequests |
| orders/prepare-shipment | PrepareShipmentRequest | request \in ShipmentRequests |
| orders/collect-shipment | CollectShipment | s \in Shipments |
| orders/cancel-remainder | CancelRemainder | o \in Orders |
| accounts/issue-invoice | IssueInvoice | s \in Shipments |
| accounts/apply-receipt | ApplyReceiptRequest | request \in ReceiptRequests |

## Misbehaviours

| Row | Item | Operator | Parameters |
| --- | --- | --- | --- |
| stock/qa | drop | QaDrop | which \in {1,2} |
| stock/qa | duplicate | QaDuplicate | which \in {1,2} |
| stock/qa | delay | QaDelay | none |
| stock/qa | reorder | QaReorder | none |
| stock/qa | fail-forever | QaForever | none |
| stock/qa | fail-then-succeed | QaRecover | none |
| stock/qa | crash | QaCrash | none |
| stock/qa | go-silent | QaSilent | none |
| orders/sales | drop | SalesDrop | which \in {1,2} |
| orders/sales | duplicate | SalesDuplicate | which \in {1,2} |
| orders/sales | delay | SalesDelay | none |
| orders/sales | reorder | SalesReorder | none |
| orders/sales | fail-forever | SalesForever | none |
| orders/sales | fail-then-succeed | SalesRecover | none |
| orders/sales | crash | SalesCrash | none |
| orders/sales | go-silent | SalesSilent | none |
| orders/picker | drop | PickerDrop | which \in {1,2} |
| orders/picker | duplicate | PickerDuplicate | which \in {1,2} |
| orders/picker | delay | PickerDelay | none |
| orders/picker | reorder | PickerReorder | none |
| orders/picker | fail-forever | PickerForever | none |
| orders/picker | fail-then-succeed | PickerRecover | none |
| orders/picker | crash | PickerCrash | none |
| orders/picker | go-silent | PickerSilent | none |
| orders/customer | drop | CustomerDrop | which \in {1,2} |
| orders/customer | duplicate | CustomerDuplicate | which \in {1,2} |
| orders/customer | delay | CustomerDelay | none |
| orders/customer | reorder | CustomerReorder | none |
| orders/customer | fail-forever | CustomerForever | none |
| orders/customer | fail-then-succeed | CustomerRecover | none |
| orders/customer | crash | CustomerCrash | none |
| orders/customer | go-silent | CustomerSilent | none |
| orders/carrier | drop | CarrierDrop | which \in {1,2} |
| orders/carrier | duplicate | CarrierDuplicate | which \in {1,2} |
| orders/carrier | delay | CarrierDelay | none |
| orders/carrier | reorder | CarrierReorder | none |
| orders/carrier | fail-forever | CarrierForever | none |
| orders/carrier | fail-then-succeed | CarrierRecover | none |
| orders/carrier | crash | CarrierCrash | none |
| orders/carrier | go-silent | CarrierSilent | none |
| accounts/finance | drop | FinanceDrop | which \in {1,2} |
| accounts/finance | duplicate | FinanceDuplicate | which \in {1,2} |
| accounts/finance | delay | FinanceDelay | none |
| accounts/finance | reorder | FinanceReorder | none |
| accounts/finance | fail-forever | FinanceForever | none |
| accounts/finance | fail-then-succeed | FinanceRecover | none |
| accounts/finance | crash | FinanceCrash | none |
| accounts/finance | go-silent | FinanceSilent | none |

## Phases

| Lifecycle | Over | Expression |
| --- | --- | --- |
| stock/batch | b \in Batches | BatchPhase(b) |
| orders/order | o \in Orders | OrderPhase(o) |
| orders/shipment | s \in Shipments | ShipmentPhase(s) |
| accounts/invoice | s \in Shipments | InvoicePhase(s) |
