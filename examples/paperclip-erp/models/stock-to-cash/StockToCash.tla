----------------------------- MODULE StockToCash -----------------------------
EXTENDS Integers, FiniteSets, Sequences, TLC

CONSTANTS Batches, Cartons, Customers, Orders, Shipments, Receipts, Decisions,
          MaxQuantity, LimitValues, Focuses, Profiles, Hazards
VARIABLES db, limits, focus, env, profile, hazard, observation
vars == <<db, limits, focus, env, profile, hazard, observation>>

(* Money is counted in ten-pound units.  Zero is an unused foreign key. *)
CartonSets == SUBSET Cartons
Quantities == 0..MaxQuantity
Revisions == 0..Cardinality(Decisions)
ZeroOn(S) == [x \in S |-> 0]
EmptyOn(S) == [x \in S |-> {}]
(* Exact client input is a six-digit radix-16 number: kind, identity, a,
   b, c, carton bitmap.  Every supplied field is below 16 at these bounds;
   carton identities 1..4 occupy the bitmap's four low bits.  This encoding
   preserves the original request even when a fault corrupts ERP identity
   records.  No reconstruction reads mutable business state. *)
CartonCode(cs) == (IF 1 \in cs THEN 1 ELSE 0) +
  (IF 2 \in cs THEN 2 ELSE 0) + (IF 3 \in cs THEN 4 ELSE 0) +
  (IF 4 \in cs THEN 8 ELSE 0)
Cmd(k,i,a,b,c,cs) == (((((k*16+i)*16+a)*16+b)*16+c)*16)+CartonCode(cs)
NoCmd == 0
CmdType == 0..(16^6-1)
CmdKind(n) == (n \div (16^5)) % 16
CmdId(n) == (n \div (16^4)) % 16
CmdA(n) == (n \div (16^3)) % 16
CmdB(n) == (n \div (16^2)) % 16
CmdC(n) == (n \div 16) % 16
CmdCartons(n) == {c \in Cartons: ((n % 16) \div (2^(c-1))) % 2 = 1}
EmptyEnvironment == [mode |-> 0, reply |-> 0, last |-> NoCmd,
  previous |-> NoCmd, retry |-> NoCmd, delayed |-> NoCmd,
  delivered |-> NoCmd, dropped |-> NoCmd, copies |-> 0, failure |-> 0, samples |-> 0, stage |-> 0]

(* Input/effect observation is ghost state, not a business mechanism.
   The ERP records alone cannot distinguish a submitted amount or identity from
   a substituted result, or an exact replay from a fresh command with the same
   resulting records. Every taken business Commit therefore compares its
   ORIGINAL scalar Cmd, prestate db, proposed poststate result and fixed limits.
   No request field is reconstructed from a mutable ERP record or world sample.

   Interface: observation = [raw |-> Cmd, failed |-> a subset of
   {"shape","actor","input","effect"}]. Correct transitions share NoInputIssue.
   A disagreement retains the original Cmd and the failed predicate categories;
   invalid or conflicting input is retained even when result = db. Test for a
   retained disagreement with observation'.failed # {} or the whole record
   differing from NoInputIssue, not raw # NoCmd: malformed zero is retainable.
   Each actual world transition normalizes this one-transition view too. Pure
   TLA stuttering is ignored by the usual [AP]_vars transition formulation.

   The ten numbered input/effect predicates below are an independent catalogue.
   n is original input, d the prestate database, e the proposed poststate.
   They call neither business actions nor their guard/effect helpers, Commit,
   or the volatile world sampler. They compare supplied fields to prestate
   conditions and poststate effects, frame unrelated fields, and frame other
   identities inside changed maps. Every exact replay requires e = d. Thus a
   non-receipt command creating a receipt, or order 1 replay creating order 2,
   retains the actual command rather than looking like legitimate fresh input.

   A claim must NOT be implemented as ObserverClean or generic flag absence.
   Its own state/history and transition clauses decide its own sentence from
   retained original input, db and db'. Shape, actor, input or effect failure
   alone is not that claim's verdict. Skipping command-specific checks on clean
   transitions is justified only when review establishes that this catalogue
   entails those particular checks. Cross-command frames remain claim-specific.
   Faults must preserve the original Cmd argument and the observer itself;
   fabricating that argument would invalidate the observation, not test a
   business mechanism. TypeOK deliberately admits every observer failure.

   Observation never guards or chooses a business/world transition. Erasing it
   and these predicates restores the original ERP/world transition relation;
   existing domains, input families and incident bounds are unchanged. Correct
   transitions can share one observer value, avoiding input-history state
   multiplication, at the cost of evaluating the catalogue. Fault searches may
   retain additional raw payloads. The first-two world samples still bound only
   the declared incident coverage; observation applies to every taken Commit.

   This finite quotient preserves the listed local input/effect distinctions,
   not complete history, occurrence counts, retry ordering, timing, or arbitrary
   later propositions about correct inputs. It has no growing log or counter,
   step bound, behavior restriction or new business action. Requests rejected
   by original guards still have no transition; they are not logged attempts.
   Future propositions beyond this catalogue need a suitable new observation.
   All money remains measured in ten-pound units. *)
ObservationFlags == {"shape", "actor", "input", "effect"}
NoInputIssue == [raw |-> NoCmd, failed |-> {}]
ObserveSameFields(d,e,except) ==
  /\ DOMAIN e = DOMAIN d
  /\ \A field \in DOMAIN d \ except: e[field] = d[field]
ObserveSameEntries(f,g,except) ==
  /\ DOMAIN g = DOMAIN f
  /\ \A key \in DOMAIN f \ except: g[key] = f[key]
ObserveReleased(d,c) == IF d.cartonBatch[c] \in Batches
  THEN d.batchPhase[d.cartonBatch[c]] = "released" ELSE FALSE
ObserveCollected(d,o) == {c \in d.orderCartons[o]:
  IF d.collectedBy[c] \in Shipments
  THEN d.shipmentOrder[d.collectedBy[c]] = o ELSE FALSE}
ObserveRemainder(d,o) == d.orderCartons[o] \ ObserveCollected(d,o)
ObserveActor(n) == CASE CmdKind(n) \in {1,6} -> 3
  [] CmdKind(n) \in {2,3} -> 1 [] CmdKind(n) \in {4,5} -> 2
  [] CmdKind(n) = 7 -> 5 [] CmdKind(n) = 8 -> 4 [] OTHER -> 6
ObserveShape(n) ==
  LET k == CmdKind(n) i == CmdId(n) a == CmdA(n)
      b == CmdB(n) c == CmdC(n) cs == CmdCartons(n)
  IN /\ n = Cmd(k,i,a,b,c,cs)
     /\ CASE k = 1 -> i \in Batches /\ a \in Quantities /\ b = 0 /\ c = 0
          [] k = 2 -> i \in Decisions /\ a \in Batches /\ b \in Revisions /\ c \in {0,1} /\ cs = {}
          [] k = 3 -> i \in Decisions /\ a \in Batches /\ b \in Revisions /\ c = 0 /\ cs = {}
          [] k = 4 -> i \in Orders /\ a \in Customers /\ b \in Quantities /\ c = 0 /\ cs = {}
          [] k = 5 -> i \in Orders /\ a \in Customers /\ b \in Quantities /\ c = 0
          [] k = 6 -> i \in Shipments /\ a \in Orders /\ b = 0 /\ c = 0
          [] k \in {7,9} -> i \in Shipments /\ a = 0 /\ b = 0 /\ c = 0 /\ cs = {}
          [] k = 8 -> i \in Orders /\ a = 0 /\ b = 0 /\ c = 0 /\ cs = {}
          [] k = 10 -> i \in Receipts /\ a \in Shipments /\ b \in Quantities /\ c = 0 /\ cs = {}
          [] OTHER -> FALSE

(* 1. Batch input is new and non-overlapping, or exactly matches its receipt.
   A successful replay leaves the entire ERP database unchanged. *)
ObserveReceiveInput(n,d) ==
  LET b == CmdId(n) q == CmdA(n) cs == CmdCartons(n)
  IN /\ q = Cardinality(cs)
     /\ IF d.batchPhase[b] = "unrecorded"
        THEN \A c \in cs: d.cartonBatch[c] = 0
        ELSE d.batchCartons[b] = cs /\ d.batchQty[b] = q
ObserveReceiveEffect(n,d,e) ==
  LET b == CmdId(n) q == CmdA(n) cs == CmdCartons(n)
  IN IF d.batchPhase[b] # "unrecorded" THEN e = d
     ELSE /\ e.batchPhase[b] = "held" /\ e.batchCartons[b] = cs /\ e.batchQty[b] = q
          /\ ObserveSameEntries(d.batchPhase,e.batchPhase,{b})
          /\ ObserveSameEntries(d.batchCartons,e.batchCartons,{b})
          /\ ObserveSameEntries(d.batchQty,e.batchQty,{b})
          /\ \A c \in Cartons: e.cartonBatch[c] = IF c \in cs THEN b ELSE d.cartonBatch[c]
          /\ e.onHand = d.onHand \cup cs
          /\ ObserveSameFields(d,e,{"batchPhase","batchCartons","batchQty","cartonBatch","onHand"})

(* 2. Release compares the submitted revision and inspection, not a revision
   substituted into the resulting decision record. *)
ObserveReleaseInput(n,d) ==
  LET k == CmdId(n) b == CmdA(n) v == CmdB(n) inspected == CmdC(n)
  IN IF d.qaKind[k] = 0
     THEN d.batchPhase[b] = "held" /\ v = d.revision[b] /\ inspected = 1
     ELSE d.qaKind[k] = 1 /\ d.qaBatch[k] = b /\ d.qaRevision[k] = v /\ d.qaInspected[k] = inspected
ObserveReleaseEffect(n,d,e) ==
  LET k == CmdId(n) b == CmdA(n) v == CmdB(n) inspected == CmdC(n)
  IN IF d.qaKind[k] # 0 THEN e = d
     ELSE /\ e.batchPhase[b] = "released" /\ e.revision[b] = d.revision[b] + 1
          /\ e.qaKind[k] = 1 /\ e.qaBatch[k] = b /\ e.qaRevision[k] = v /\ e.qaInspected[k] = inspected
          /\ ObserveSameEntries(d.batchPhase,e.batchPhase,{b})
          /\ ObserveSameEntries(d.revision,e.revision,{b})
          /\ ObserveSameEntries(d.qaKind,e.qaKind,{k})
          /\ ObserveSameEntries(d.qaBatch,e.qaBatch,{k})
          /\ ObserveSameEntries(d.qaRevision,e.qaRevision,{k})
          /\ ObserveSameEntries(d.qaInspected,e.qaInspected,{k})
          /\ ObserveSameFields(d,e,{"batchPhase","revision","qaKind","qaBatch","qaRevision","qaInspected"})

(* 3. Hold likewise compares the original submitted revision and preserves
   all stock allocation and collection history. *)
ObserveHoldInput(n,d) ==
  LET k == CmdId(n) b == CmdA(n) v == CmdB(n)
  IN IF d.qaKind[k] = 0
     THEN d.batchPhase[b] = "released" /\ v = d.revision[b]
     ELSE d.qaKind[k] = 2 /\ d.qaBatch[k] = b /\ d.qaRevision[k] = v
ObserveHoldEffect(n,d,e) ==
  LET k == CmdId(n) b == CmdA(n) v == CmdB(n)
  IN IF d.qaKind[k] # 0 THEN e = d
     ELSE /\ e.batchPhase[b] = "held" /\ e.revision[b] = d.revision[b] + 1
          /\ e.qaKind[k] = 2 /\ e.qaBatch[k] = b /\ e.qaRevision[k] = v
          /\ ObserveSameEntries(d.batchPhase,e.batchPhase,{b})
          /\ ObserveSameEntries(d.revision,e.revision,{b})
          /\ ObserveSameEntries(d.qaKind,e.qaKind,{k})
          /\ ObserveSameEntries(d.qaBatch,e.qaBatch,{k})
          /\ ObserveSameEntries(d.qaRevision,e.qaRevision,{k})
          /\ ObserveSameFields(d,e,{"batchPhase","revision","qaKind","qaBatch","qaRevision"})

(* 4. A draft records exactly the supplied identity, customer and quantity.
   Replaying one order cannot create or edit another order. *)
ObserveOrderInput(n,d) ==
  LET o == CmdId(n) c == CmdA(n) q == CmdB(n)
  IN /\ q > 0
     /\ (d.orderPhase[o] = "unrecorded" \/ (d.orderCustomer[o] = c /\ d.orderQty[o] = q))
ObserveOrderEffect(n,d,e) ==
  LET o == CmdId(n) c == CmdA(n) q == CmdB(n)
  IN IF d.orderPhase[o] # "unrecorded" THEN e = d
     ELSE /\ e.orderPhase[o] = "draft" /\ e.orderCustomer[o] = c /\ e.orderQty[o] = q
          /\ ObserveSameEntries(d.orderPhase,e.orderPhase,{o})
          /\ ObserveSameEntries(d.orderCustomer,e.orderCustomer,{o})
          /\ ObserveSameEntries(d.orderQty,e.orderQty,{o})
          /\ ObserveSameFields(d,e,{"orderPhase","orderCustomer","orderQty"})

(* 5. An unconfirmed order needs all the requested available cartons and credit.
   Its effects bind the actual submitted set and quantity together. *)
ObserveConfirmInput(n,d,lim) ==
  LET o == CmdId(n) c == CmdA(n) q == CmdB(n) cs == CmdCartons(n)
  IN /\ d.orderCustomer[o] = c /\ d.orderQty[o] = q
     /\ IF o \in d.confirmed THEN cs = d.orderCartons[o]
        ELSE /\ d.orderPhase[o] = "draft" /\ Cardinality(cs) = q
             /\ \A x \in cs: x \in d.onHand /\ d.reserved[x] = 0 /\ ObserveReleased(d,x)
             /\ d.exposure[c] + q <= lim[c]
ObserveConfirmEffect(n,d,e) ==
  LET o == CmdId(n) c == CmdA(n) q == CmdB(n) cs == CmdCartons(n)
  IN IF o \in d.confirmed THEN e = d
     ELSE /\ e.orderPhase[o] = "open" /\ e.confirmed = d.confirmed \cup {o}
          /\ e.orderCartons[o] = cs /\ e.commitment[o] = q
          /\ e.exposure[c] = d.exposure[c] + q
          /\ \A x \in Cartons: e.reserved[x] = IF x \in cs THEN o ELSE d.reserved[x]
          /\ ObserveSameEntries(d.orderPhase,e.orderPhase,{o})
          /\ ObserveSameEntries(d.orderCartons,e.orderCartons,{o})
          /\ ObserveSameEntries(d.commitment,e.commitment,{o})
          /\ ObserveSameEntries(d.exposure,e.exposure,{c})
          /\ ObserveSameFields(d,e,{"orderPhase","confirmed","orderCartons","reserved","commitment","exposure"})

(* 6. Preparation binds the submitted shipment identity, order and full set.
   Void and collected preparations still have immutable replay identities. *)
ObservePrepareInput(n,d) ==
  LET s == CmdId(n) o == CmdA(n) cs == CmdCartons(n)
  IN IF d.shipmentPhase[s] # "unprepared"
     THEN d.shipmentOrder[s] = o /\ d.shipmentCartons[s] = cs
     ELSE /\ d.orderPhase[o] = "open" /\ o \in d.confirmed /\ cs # {}
          /\ \A c \in cs:
               /\ d.reserved[c] = o /\ c \in d.onHand /\ ObserveReleased(d,c)
               /\ \A t \in Shipments: d.shipmentPhase[t] = "prepared" => c \notin d.shipmentCartons[t]
ObservePrepareEffect(n,d,e) ==
  LET s == CmdId(n) o == CmdA(n) cs == CmdCartons(n)
  IN IF d.shipmentPhase[s] # "unprepared" THEN e = d
     ELSE /\ e.shipmentPhase[s] = "prepared" /\ e.shipmentOrder[s] = o /\ e.shipmentCartons[s] = cs
          /\ \A c \in Cartons: e.picked[c] = IF c \in cs THEN s ELSE d.picked[c]
          /\ ObserveSameEntries(d.shipmentPhase,e.shipmentPhase,{s})
          /\ ObserveSameEntries(d.shipmentOrder,e.shipmentOrder,{s})
          /\ ObserveSameEntries(d.shipmentCartons,e.shipmentCartons,{s})
          /\ ObserveSameFields(d,e,{"shipmentPhase","shipmentOrder","shipmentCartons","picked"})

(* 7. Collection uses the shipment actually named and the current reservation
   and quality; its obligation is for that shipment's whole fixed set. *)
ObserveCollectInput(n,d) ==
  LET s == CmdId(n) o == d.shipmentOrder[s] cs == d.shipmentCartons[s]
  IN IF d.shipmentPhase[s] = "collected" THEN TRUE
     ELSE IF o \notin Orders THEN FALSE
     ELSE /\ d.shipmentPhase[s] = "prepared" /\ d.orderPhase[o] = "open"
          /\ \A c \in cs: c \in d.onHand /\ d.reserved[c] = o /\ ObserveReleased(d,c)
ObserveCollectEffect(n,d,e) ==
  LET s == CmdId(n) o == d.shipmentOrder[s] cs == d.shipmentCartons[s] q == Cardinality(cs)
  IN IF d.shipmentPhase[s] = "collected" THEN e = d
     ELSE /\ e.shipmentPhase[s] = "collected"
          /\ e.orderPhase[o] = IF ObserveRemainder(d,o) \ cs = {} THEN "complete" ELSE "open"
          /\ e.onHand = d.onHand \ cs /\ e.commitment[o] = d.commitment[o] - q /\ e.pending[s] = q
          /\ \A c \in Cartons:
               /\ e.reserved[c] = IF c \in cs THEN 0 ELSE d.reserved[c]
               /\ e.picked[c] = IF c \in cs THEN 0 ELSE d.picked[c]
               /\ e.collectedBy[c] = IF c \in cs THEN s ELSE d.collectedBy[c]
               /\ e.collectionCount[c] = d.collectionCount[c] + (IF c \in cs THEN 1 ELSE 0)
          /\ ObserveSameEntries(d.shipmentPhase,e.shipmentPhase,{s})
          /\ ObserveSameEntries(d.orderPhase,e.orderPhase,{o})
          /\ ObserveSameEntries(d.commitment,e.commitment,{o})
          /\ ObserveSameEntries(d.pending,e.pending,{s})
          /\ ObserveSameFields(d,e,{"shipmentPhase","orderPhase","onHand","reserved","picked","collectedBy","collectionCount","commitment","pending"})

(* 8. Cancellation binds its actual order, releasing only its uncollected
   remainder. Invoice, receipt, collection and batch history are framed. *)
ObserveCancelInput(n,d) ==
  LET o == CmdId(n)
  IN d.orderPhase[o] = "cancelled" \/
     (d.orderPhase[o] = "open" /\ o \in d.confirmed /\ d.orderCustomer[o] \in Customers /\ ObserveRemainder(d,o) # {})
ObserveCancelEffect(n,d,e) ==
  LET o == CmdId(n) cs == ObserveRemainder(d,o) c == d.orderCustomer[o] q == Cardinality(cs)
  IN IF d.orderPhase[o] = "cancelled" THEN e = d
     ELSE /\ e.orderPhase[o] = "cancelled" /\ e.commitment[o] = d.commitment[o] - q
          /\ e.exposure[c] = d.exposure[c] - q
          /\ \A x \in Cartons:
               /\ e.reserved[x] = IF x \in cs THEN 0 ELSE d.reserved[x]
               /\ e.picked[x] = IF x \in cs THEN 0 ELSE d.picked[x]
          /\ \A s \in Shipments: e.shipmentPhase[s] =
               IF d.shipmentOrder[s] = o /\ d.shipmentPhase[s] = "prepared" THEN "void" ELSE d.shipmentPhase[s]
          /\ ObserveSameEntries(d.orderPhase,e.orderPhase,{o})
          /\ ObserveSameEntries(d.commitment,e.commitment,{o})
          /\ ObserveSameEntries(d.exposure,e.exposure,{c})
          /\ ObserveSameFields(d,e,{"orderPhase","commitment","exposure","reserved","picked","shipmentPhase"})

(* 9. An invoice's command names its collected shipment; replay cannot reset
   a balance that receipts have already reduced. *)
ObserveInvoiceInput(n,d) ==
  LET s == CmdId(n)
  IN IF s \in d.issued THEN TRUE
     ELSE IF d.shipmentOrder[s] \notin Orders THEN FALSE
     ELSE d.shipmentPhase[s] = "collected" /\ d.pending[s] > 0 /\
          d.orderCustomer[d.shipmentOrder[s]] \in Customers
ObserveInvoiceEffect(n,d,e) ==
  LET s == CmdId(n) o == d.shipmentOrder[s] q == Cardinality(d.shipmentCartons[s])
  IN IF s \in d.issued THEN e = d
     ELSE /\ e.issued = d.issued \cup {s} /\ e.invoiceCount[s] = d.invoiceCount[s] + 1
          /\ e.invoiceCustomer[s] = d.orderCustomer[o] /\ e.invoiceOriginal[s] = q
          /\ e.balance[s] = q /\ e.pending[s] = 0
          /\ ObserveSameEntries(d.invoiceCount,e.invoiceCount,{s})
          /\ ObserveSameEntries(d.invoiceCustomer,e.invoiceCustomer,{s})
          /\ ObserveSameEntries(d.invoiceOriginal,e.invoiceOriginal,{s})
          /\ ObserveSameEntries(d.balance,e.balance,{s})
          /\ ObserveSameEntries(d.pending,e.pending,{s})
          /\ ObserveSameFields(d,e,{"issued","invoiceCount","invoiceCustomer","invoiceOriginal","balance","pending"})

(* 10. Receipt validity and amount come from the actual submitted fields and
   pre-application balance. A clipped stored amount cannot substitute for input. *)
ObserveReceiptInput(n,d) ==
  LET p == CmdId(n) s == CmdA(n) a == CmdB(n)
  IN IF d.receiptShipment[p] # 0
     THEN d.receiptShipment[p] = s /\ d.receiptAmount[p] = a
     ELSE s \in d.issued /\ d.invoiceCustomer[s] \in Customers /\ a > 0 /\ a <= d.balance[s]
ObserveReceiptEffect(n,d,e) ==
  LET p == CmdId(n) s == CmdA(n) a == CmdB(n) c == d.invoiceCustomer[s]
  IN IF d.receiptShipment[p] # 0 THEN e = d
     ELSE /\ e.receiptShipment[p] = s /\ e.receiptAmount[p] = a
          /\ e.balance[s] = d.balance[s] - a /\ e.exposure[c] = d.exposure[c] - a
          /\ ObserveSameEntries(d.receiptShipment,e.receiptShipment,{p})
          /\ ObserveSameEntries(d.receiptAmount,e.receiptAmount,{p})
          /\ ObserveSameEntries(d.balance,e.balance,{s})
          /\ ObserveSameEntries(d.exposure,e.exposure,{c})
          /\ ObserveSameFields(d,e,{"receiptShipment","receiptAmount","balance","exposure"})

ObserveInput(n,d,lim) == CASE CmdKind(n) = 1 -> ObserveReceiveInput(n,d)
  [] CmdKind(n) = 2 -> ObserveReleaseInput(n,d) [] CmdKind(n) = 3 -> ObserveHoldInput(n,d)
  [] CmdKind(n) = 4 -> ObserveOrderInput(n,d) [] CmdKind(n) = 5 -> ObserveConfirmInput(n,d,lim)
  [] CmdKind(n) = 6 -> ObservePrepareInput(n,d) [] CmdKind(n) = 7 -> ObserveCollectInput(n,d)
  [] CmdKind(n) = 8 -> ObserveCancelInput(n,d) [] CmdKind(n) = 9 -> ObserveInvoiceInput(n,d)
  [] OTHER -> ObserveReceiptInput(n,d)
ObserveEffect(n,d,e) == CASE CmdKind(n) = 1 -> ObserveReceiveEffect(n,d,e)
  [] CmdKind(n) = 2 -> ObserveReleaseEffect(n,d,e) [] CmdKind(n) = 3 -> ObserveHoldEffect(n,d,e)
  [] CmdKind(n) = 4 -> ObserveOrderEffect(n,d,e) [] CmdKind(n) = 5 -> ObserveConfirmEffect(n,d,e)
  [] CmdKind(n) = 6 -> ObservePrepareEffect(n,d,e) [] CmdKind(n) = 7 -> ObserveCollectEffect(n,d,e)
  [] CmdKind(n) = 8 -> ObserveCancelEffect(n,d,e) [] CmdKind(n) = 9 -> ObserveInvoiceEffect(n,d,e)
  [] OTHER -> ObserveReceiptEffect(n,d,e)
ObserveTaken(actor,n,d,e,lim) ==
  LET shape == ObserveShape(n)
      input == IF shape THEN ObserveInput(n,d,lim) ELSE FALSE
      effect == IF input THEN ObserveEffect(n,d,e) ELSE e = d
      failures == (IF shape THEN {} ELSE {"shape"})
        \cup (IF shape /\ actor = ObserveActor(n) THEN {} ELSE {"actor"})
        \cup (IF input THEN {} ELSE {"input"})
        \cup (IF effect THEN {} ELSE {"effect"})
  IN IF failures = {} THEN NoInputIssue ELSE [raw |-> n, failed |-> failures]
ObserverClean == observation = NoInputIssue


(* 1 QA, 2 sales, 3 picker, 4 customer, 5 carrier, 6 finance. *)
CanAct(a) == a # focus \/ env.mode \in {0,1}
(* A completed nonblocking incident is observable in the state it creates.
   The next business commit may forget that auxiliary observation; focus=0
   then prevents another incident.  Pending replies and failed actors remain. *)
ForgetObservation == env.stage = 2 /\ env.mode = 0 /\
  env.delayed = NoCmd /\ env.retry = NoCmd /\ env.failure # 1
SampleReplies == hazard = 0 \/ (hazard = 4 /\ env.stage = 1)
PendingObservation == env.stage = 2 /\ env.mode = 0 /\ env.delayed # NoCmd
Commit(a,request,result) ==
  /\ CanAct(a)
  /\ observation' = ObserveTaken(a,request,db,result,limits)
  /\ db' = result
  /\ UNCHANGED <<limits,profile>>
  /\ focus' = IF ForgetObservation THEN 0 ELSE focus
  /\ hazard' = IF ForgetObservation THEN 0 ELSE hazard
  /\ env' = IF ForgetObservation THEN EmptyEnvironment
    ELSE IF PendingObservation THEN [env EXCEPT !.last = NoCmd, !.previous = NoCmd,
         !.delivered = NoCmd, !.samples = 0, !.reply = 2]
    ELSE IF a # focus \/ (env.stage = 2 /\ env.mode = 0 /\ env.retry = NoCmd /\ request # NoCmd /\ env.failure # 1) THEN env ELSE
       [env EXCEPT !.mode = 0,
         !.reply = IF env.stage = 2 THEN env.reply ELSE 1,
         !.previous = IF env.samples = 1 /\ SampleReplies THEN env.last ELSE env.previous,
         !.last = IF env.samples < 2 /\ SampleReplies THEN request ELSE env.last,
         !.samples = IF env.samples < 2 /\ SampleReplies THEN env.samples + 1 ELSE env.samples,
         !.retry = IF env.retry = request THEN NoCmd ELSE env.retry,
         !.copies = IF env.retry = request THEN 2 ELSE env.copies,
         !.failure = IF env.failure = 1 THEN 2 ELSE env.failure,
         !.stage = IF (hazard = 2 /\ env.retry = request /\ request # NoCmd)
                     \/ (hazard = 6 /\ env.failure = 1) THEN 2 ELSE env.stage]

(* Profiles fix input data, never an order or a number of business steps.
   1 last-credit; 2 last-cartons/reuse/QA; 3 split shipment; 4 two batches;
   5 requests above credit or physical stock. *)
PairA == Cartons \cap {1,2}
PairB == Cartons \cap {3,4}
CustomerInputs(o) == IF db.orderPhase[o] # "unrecorded" THEN Customers
  ELSE {IF o = 1 \/ profile = 1 THEN 1 ELSE 2}
QuantityInputs(o) == IF db.orderPhase[o] # "unrecorded" THEN Quantities
  ELSE {IF profile = 5 THEN (IF o = 1 THEN 3 ELSE 5)
        ELSE IF profile \in {3,4} /\ o = 1 THEN 4 ELSE 2}
BatchInputs(b) == IF db.batchPhase[b] # "unrecorded" THEN CartonSets
  ELSE IF profile = 4 THEN (IF b = 1 THEN {PairA} ELSE {PairA,PairB})
  ELSE IF b = 1 THEN {IF profile = 2 THEN PairA ELSE Cartons} ELSE {}
ConfirmInputs(o) == IF o \in db.confirmed THEN CartonSets
  ELSE {PairA,PairB,Cartons,Cartons \cap {1,2,3}}
PrepareInputs == {PairA,PairB,Cartons}
NewReleaseInputs == IF profile = 4 THEN
  {<<1,1,0>>,<<2,2,0>>,<<4,1,1>>,<<4,1,2>>,<<4,2,1>>,<<4,2,2>>}
  ELSE {<<1,1,0>>,<<3,1,1>>,<<3,1,2>>}
NewHoldInputs == IF profile = 4 THEN
  {<<3,1,0>>,<<3,1,1>>,<<3,2,0>>,<<3,2,1>>}
  ELSE {<<2,1,0>>,<<2,1,1>>,<<4,1,2>>,<<4,1,3>>}
ReleaseRequests == UNION {IF db.qaKind[k] = 0 THEN
  {<<r[1],r[2],r[3],i>>: r \in {r \in NewReleaseInputs: r[1] = k}, i \in BOOLEAN}
  ELSE {<<k,b,v,i>>: b \in Batches, v \in Revisions, i \in BOOLEAN}: k \in Decisions}
HoldRequests == UNION {IF db.qaKind[k] = 0 THEN
  {r \in NewHoldInputs: r[1] = k}
  ELSE {<<k,b,v>>: b \in Batches, v \in Revisions}: k \in Decisions}
ShipmentRequests == UNION {IF db.shipmentPhase[s] = "unprepared" THEN
  (IF s = 1 THEN {<<1,1,PairA>>,<<1,1,Cartons>>}
   ELSE {<<s,1,PairB>>,<<s,2,PairA>>,<<s,2,PairB>>,<<s,2,Cartons>>})
  ELSE {<<s,o,cs>>: o \in Orders, cs \in CartonSets}: s \in Shipments}
ReceiptRequests == UNION {IF db.receiptShipment[p] = 0 THEN
  {<<p,IF p = 3 THEN 2 ELSE 1,a>>: a \in Quantities}
  ELSE {<<p,s,a>>: s \in Shipments, a \in Quantities}: p \in Receipts}
BatchRequests == UNION {{<<b,cs,q>>: cs \in BatchInputs(b), q \in Quantities}: b \in Batches}
OrderRequests == UNION {{<<o,c,q>>: c \in CustomerInputs(o), q \in QuantityInputs(o)}: o \in Orders}
ConfirmationRequests == UNION {{<<o,c,q,cs>>: c \in Customers, q \in Quantities,
  cs \in ConfirmInputs(o)}: o \in Orders}

Init ==
  /\ profile \in Profiles
  /\ limits = [c \in Customers |-> IF c = 1 /\ profile \in {1,5} THEN 2 ELSE 10]
  /\ focus \in Focuses
  /\ hazard = 0
  /\ env = EmptyEnvironment
  /\ observation = NoInputIssue
  /\ db = [batchPhase |-> [b \in Batches |-> "unrecorded"],
      batchCartons |-> EmptyOn(Batches), batchQty |-> ZeroOn(Batches),
      revision |-> ZeroOn(Batches), cartonBatch |-> ZeroOn(Cartons),
      qaKind |-> ZeroOn(Decisions), qaBatch |-> ZeroOn(Decisions),
      qaRevision |-> ZeroOn(Decisions), qaInspected |-> ZeroOn(Decisions),
      onHand |-> {}, reserved |-> ZeroOn(Cartons), picked |-> ZeroOn(Cartons),
      collectedBy |-> ZeroOn(Cartons), collectionCount |-> ZeroOn(Cartons),
      orderPhase |-> [o \in Orders |-> "unrecorded"],
      orderCustomer |-> ZeroOn(Orders), orderQty |-> ZeroOn(Orders),
      confirmed |-> {}, orderCartons |-> EmptyOn(Orders), commitment |-> ZeroOn(Orders),
      shipmentPhase |-> [s \in Shipments |-> "unprepared"],
      shipmentOrder |-> ZeroOn(Shipments), shipmentCartons |-> EmptyOn(Shipments),
      pending |-> ZeroOn(Shipments), issued |-> {}, invoiceCount |-> ZeroOn(Shipments),
      invoiceCustomer |-> ZeroOn(Shipments), invoiceOriginal |-> ZeroOn(Shipments),
      balance |-> ZeroOn(Shipments), exposure |-> ZeroOn(Customers),
      receiptShipment |-> ZeroOn(Receipts), receiptAmount |-> ZeroOn(Receipts)]

TypeOK ==
  /\ DOMAIN observation = {"raw","failed"}
  /\ observation.raw \in CmdType
  /\ observation.failed \subseteq ObservationFlags
  /\ profile \in Profiles
  /\ limits \in [Customers -> LimitValues]
  /\ focus \in Focuses
  /\ hazard \in Hazards \cup {0}
  /\ env \in [mode:0..4, reply:0..5, last:CmdType, previous:CmdType,
       retry:CmdType, delayed:CmdType, delivered:CmdType, dropped:CmdType,
       copies:0..2, failure:0..2, samples:0..2, stage:0..2]
  /\ db.batchPhase \in [Batches -> {"unrecorded","held","released"}]
  /\ db.batchCartons \in [Batches -> SUBSET Cartons]
  /\ db.batchQty \in [Batches -> Nat]
  /\ db.revision \in [Batches -> Nat]
  /\ db.cartonBatch \in [Cartons -> Batches \cup {0}]
  /\ db.qaKind \in [Decisions -> 0..2]
  /\ db.qaBatch \in [Decisions -> Batches \cup {0}]
  /\ db.qaRevision \in [Decisions -> Nat]
  /\ db.qaInspected \in [Decisions -> 0..1]
  /\ db.onHand \subseteq Cartons
  /\ db.reserved \in [Cartons -> Orders \cup {0}]
  /\ db.picked \in [Cartons -> Shipments \cup {0}]
  /\ db.collectedBy \in [Cartons -> Shipments \cup {0}]
  /\ db.collectionCount \in [Cartons -> Nat]
  /\ db.orderPhase \in [Orders -> {"unrecorded","draft","open","complete","cancelled"}]
  /\ db.orderCustomer \in [Orders -> Customers \cup {0}]
  /\ db.orderQty \in [Orders -> Nat]
  /\ db.confirmed \subseteq Orders
  /\ db.orderCartons \in [Orders -> SUBSET Cartons]
  /\ db.commitment \in [Orders -> Int]
  /\ db.shipmentPhase \in [Shipments -> {"unprepared","prepared","collected","void"}]
  /\ db.shipmentOrder \in [Shipments -> Orders \cup {0}]
  /\ db.shipmentCartons \in [Shipments -> SUBSET Cartons]
  /\ db.pending \in [Shipments -> Int]
  /\ db.issued \subseteq Shipments
  /\ db.invoiceCount \in [Shipments -> Nat]
  /\ db.invoiceCustomer \in [Shipments -> Customers \cup {0}]
  /\ db.invoiceOriginal \in [Shipments -> Nat]
  /\ db.balance \in [Shipments -> Int]
  /\ db.exposure \in [Customers -> Int]
  /\ db.receiptShipment \in [Receipts -> Shipments \cup {0}]
  /\ db.receiptAmount \in [Receipts -> Nat]

BatchPhase(b) == db.batchPhase[b]
OrderPhase(o) == db.orderPhase[o]
ShipmentPhase(s) == db.shipmentPhase[s]
InvoicePhase(s) == IF s \notin db.issued THEN "unissued"
  ELSE IF db.balance[s] = 0 THEN "settled"
  ELSE IF db.balance[s] = db.invoiceOriginal[s] THEN "unpaid" ELSE "part-paid"
Recorded == {c \in Cartons: db.cartonBatch[c] # 0}
Released(c) == IF db.cartonBatch[c] = 0 THEN FALSE
               ELSE db.batchPhase[db.cartonBatch[c]] = "released"
Available == {c \in db.onHand: db.reserved[c] = 0 /\ Released(c)}
Reserved(o) == {c \in Cartons: db.reserved[c] = o}
Collected(o) == {c \in db.orderCartons[o]: db.collectedBy[c] # 0 /\ db.shipmentOrder[db.collectedBy[c]] = o}
Remaining(o) == db.orderCartons[o] \ Collected(o)
LiveShipments == {s \in Shipments: db.shipmentPhase[s] \in {"prepared","collected"}}
RECURSIVE SumOn(_, _)
SumOn(S,f) == IF S = {} THEN 0 ELSE
  LET x == CHOOSE x \in S: TRUE IN f[x] + SumOn(S \ {x},f)
Exposure(c) ==
  SumOn({o \in Orders: db.orderCustomer[o] = c},db.commitment) +
  SumOn({s \in Shipments: db.shipmentOrder[s] # 0 /\
    db.orderCustomer[db.shipmentOrder[s]] = c},db.pending) +
  SumOn({s \in db.issued: db.invoiceCustomer[s] = c},db.balance)
Paid(s) == SumOn({p \in Receipts: db.receiptShipment[p] = s},db.receiptAmount)

(* Receive one immutable batch, or return its prior receipt without resetting QA. *)
ReceiveBatch(b,cs,q) ==
  /\ q = Cardinality(cs)
  /\ IF db.batchPhase[b] = "unrecorded" THEN
       /\ cs \cap Recorded = {}
       /\ Commit(3,Cmd(1,b,q,0,0,cs),[db EXCEPT
            !.batchPhase[b] = "held", !.batchCartons[b] = cs, !.batchQty[b] = q,
            !.cartonBatch = [c \in Cartons |-> IF c \in cs THEN b ELSE db.cartonBatch[c]],
            !.onHand = @ \cup cs])
     ELSE /\ db.batchCartons[b] = cs /\ db.batchQty[b] = q
          /\ Commit(3,Cmd(1,b,q,0,0,cs),db)

(* A fresh release uses the current revision; a recorded operation replays exactly. *)
ReleaseBatch(k,b,v,inspected) ==
  /\ IF db.qaKind[k] = 0 THEN
       /\ db.batchPhase[b] = "held" /\ inspected /\ v = db.revision[b]
       /\ Commit(1,Cmd(2,k,b,v,IF inspected THEN 1 ELSE 0,{}),[db EXCEPT
            !.batchPhase[b] = "released", !.revision[b] = @ + 1,
            !.qaKind[k] = 1, !.qaBatch[k] = b, !.qaRevision[k] = v, !.qaInspected[k] = 1])
     ELSE /\ db.qaKind[k] = 1 /\ db.qaBatch[k] = b /\ db.qaRevision[k] = v
          /\ db.qaInspected[k] = (IF inspected THEN 1 ELSE 0)
          /\ Commit(1,Cmd(2,k,b,v,IF inspected THEN 1 ELSE 0,{}),db)

(* A current hold changes quality only, retaining reservations and collected history. *)
HoldBatch(k,b,v) ==
  /\ IF db.qaKind[k] = 0 THEN
       /\ db.batchPhase[b] = "released" /\ v = db.revision[b]
       /\ Commit(1,Cmd(3,k,b,v,0,{}),[db EXCEPT
            !.batchPhase[b] = "held", !.revision[b] = @ + 1,
            !.qaKind[k] = 2, !.qaBatch[k] = b, !.qaRevision[k] = v])
     ELSE /\ db.qaKind[k] = 2 /\ db.qaBatch[k] = b /\ db.qaRevision[k] = v
          /\ Commit(1,Cmd(3,k,b,v,0,{}),db)

(* A draft records customer and positive quantity but takes neither stock nor credit. *)
RecordOrder(o,c,q) ==
  /\ q > 0
  /\ IF db.orderPhase[o] = "unrecorded" THEN
       Commit(2,Cmd(4,o,c,q,0,{}),[db EXCEPT !.orderPhase[o] = "draft",
          !.orderCustomer[o] = c, !.orderQty[o] = q])
     ELSE /\ db.orderCustomer[o] = c /\ db.orderQty[o] = q
          /\ Commit(2,Cmd(4,o,c,q,0,{}),db)

(* Confirmation reserves identified cartons and full credit in the same commit. *)
ConfirmOrder(o,c,q,cs) ==
  /\ db.orderCustomer[o] = c /\ db.orderQty[o] = q
  /\ IF o \in db.confirmed THEN
       /\ cs = db.orderCartons[o]
       /\ Commit(2,Cmd(5,o,c,q,0,cs),db)
     ELSE /\ db.orderPhase[o] = "draft" /\ Cardinality(cs) = q
          /\ cs \subseteq Available /\ db.exposure[c] + q <= limits[c]
          /\ Commit(2,Cmd(5,o,c,q,0,cs),[db EXCEPT
               !.orderPhase[o] = "open", !.confirmed = @ \cup {o}, !.orderCartons[o] = cs,
               !.reserved = [x \in Cartons |-> IF x \in cs THEN o ELSE db.reserved[x]],
               !.commitment[o] = q, !.exposure[c] = @ + q])

(* Preparation fixes every carton at once; a replay survives collection or voiding. *)
PrepareShipment(s,o,cs) ==
  /\ IF db.shipmentPhase[s] = "unprepared" THEN
       /\ db.orderPhase[o] = "open" /\ cs # {}
       /\ cs \subseteq Reserved(o) /\ \A c \in cs: Released(c) /\ db.picked[c] = 0
       /\ Commit(3,Cmd(6,s,o,0,0,cs),[db EXCEPT
            !.shipmentPhase[s] = "prepared", !.shipmentOrder[s] = o, !.shipmentCartons[s] = cs,
            !.picked = [c \in Cartons |-> IF c \in cs THEN s ELSE db.picked[c]]])
     ELSE /\ db.shipmentOrder[s] = o /\ db.shipmentCartons[s] = cs
          /\ Commit(3,Cmd(6,s,o,0,0,cs),db)

(* The authorised physical handoff replaces just its commitment by durable debt. *)
CollectShipment(s) ==
  IF db.shipmentPhase[s] = "collected" THEN Commit(5,Cmd(7,s,0,0,0,{}),db)
  ELSE /\ db.shipmentPhase[s] = "prepared"
       /\ LET o == db.shipmentOrder[s]
              cs == db.shipmentCartons[s]
              q == Cardinality(cs)
          IN /\ db.orderPhase[o] = "open"
             /\ cs \subseteq db.onHand /\ cs \subseteq Reserved(o)
             /\ \A c \in cs: Released(c)
             /\ Commit(5,Cmd(7,s,0,0,0,{}),[db EXCEPT
                  !.shipmentPhase[s] = "collected",
                  !.orderPhase[o] = IF Remaining(o) \ cs = {} THEN "complete" ELSE "open",
                  !.onHand = @ \ cs,
                  !.reserved = [c \in Cartons |-> IF c \in cs THEN 0 ELSE db.reserved[c]],
                  !.picked = [c \in Cartons |-> IF c \in cs THEN 0 ELSE db.picked[c]],
                  !.collectedBy = [c \in Cartons |-> IF c \in cs THEN s ELSE db.collectedBy[c]],
                  !.collectionCount = [c \in Cartons |-> IF c \in cs THEN db.collectionCount[c]+1 ELSE db.collectionCount[c]],
                  !.commitment[o] = @ - q, !.pending[s] = q])

(* Cancellation releases only the uncollected remainder and voids its preparations. *)
CancelRemainder(o) ==
  IF db.orderPhase[o] = "cancelled" THEN Commit(4,Cmd(8,o,0,0,0,{}),db)
  ELSE /\ db.orderPhase[o] = "open" /\ Remaining(o) # {}
       /\ LET cs == Remaining(o)
              c == db.orderCustomer[o]
              q == Cardinality(cs)
          IN Commit(4,Cmd(8,o,0,0,0,{}),[db EXCEPT
               !.orderPhase[o] = "cancelled", !.commitment[o] = @ - q,
               !.exposure[c] = @ - q,
               !.reserved = [x \in Cartons |-> IF x \in cs THEN 0 ELSE db.reserved[x]],
               !.picked = [x \in Cartons |-> IF x \in cs THEN 0 ELSE db.picked[x]],
               !.shipmentPhase = [s \in Shipments |->
                  IF db.shipmentOrder[s] = o /\ db.shipmentPhase[s] = "prepared"
                  THEN "void" ELSE db.shipmentPhase[s]]])

(* Issue the shipment-keyed invoice later, transferring debt without releasing credit. *)
IssueInvoice(s) ==
  IF s \in db.issued THEN Commit(6,Cmd(9,s,0,0,0,{}),db)
  ELSE /\ db.shipmentPhase[s] = "collected" /\ db.pending[s] > 0
       /\ Commit(6,Cmd(9,s,0,0,0,{}),[db EXCEPT
            !.issued = @ \cup {s}, !.invoiceCount[s] = @ + 1,
            !.invoiceCustomer[s] = db.orderCustomer[db.shipmentOrder[s]],
            !.invoiceOriginal[s] = Cardinality(db.shipmentCartons[s]),
            !.balance[s] = Cardinality(db.shipmentCartons[s]), !.pending[s] = 0])

(* Apply a unique positive receipt once, reducing invoice debt and exposure together. *)
ApplyReceipt(p,s,a) ==
  IF db.receiptShipment[p] # 0 THEN
    /\ db.receiptShipment[p] = s /\ db.receiptAmount[p] = a
    /\ Commit(6,Cmd(10,p,s,a,0,{}),db)
  ELSE /\ s \in db.issued /\ a > 0 /\ a <= db.balance[s]
       /\ Commit(6,Cmd(10,p,s,a,0,{}),[db EXCEPT
            !.receiptShipment[p] = s, !.receiptAmount[p] = a,
            !.balance[s] = @ - a, !.exposure[db.invoiceCustomer[s]] = @ - a])

ReleaseBatchRequest(r) == ReleaseBatch(r[1],r[2],r[3],r[4])
HoldBatchRequest(r) == HoldBatch(r[1],r[2],r[3])
PrepareShipmentRequest(r) == PrepareShipment(r[1],r[2],r[3])
ApplyReceiptRequest(r) == ApplyReceipt(r[1],r[2],r[3])
ReceiveBatchRequest(r) == ReceiveBatch(r[1],r[2],r[3])
RecordOrderRequest(r) == RecordOrder(r[1],r[2],r[3])
ConfirmOrderRequest(r) == ConfirmOrder(r[1],r[2],r[3],r[4])

(* World requests and replies are volatile; all ERP writes above are atomic and durable.
   A last/prior command is a sample of submitted input, not an instruction for an actor.
   Ordinary fresh requests and exact retries remain possible for all active actors. *)
(* The incident is chosen when it occurs, so identical fault-free prefixes
   are shared.  Before that choice hazard=0; after it the same bounds apply. *)
EnvironmentFor(h,e) == /\ hazard' = h /\ env' = e
  /\ observation' = NoInputIssue
  /\ UNCHANGED <<db,limits,focus,profile>>
WorldReady(a) == a = focus /\ env.mode \in {0,1}
DropReply(a,which) ==
  /\ WorldReady(a) /\ hazard = 0 /\ 1 \in Hazards /\ env.stage = 0
  /\ IF which = 1 THEN
       /\ env.reply = 1 /\ env.last # NoCmd
       /\ EnvironmentFor(1,[EmptyEnvironment EXCEPT !.reply = 4, !.dropped = env.last, !.stage = 2])
     ELSE /\ env.delayed # NoCmd
          /\ EnvironmentFor(1,[EmptyEnvironment EXCEPT !.dropped = env.delayed, !.stage = 2])
DuplicateRequest(a,which) ==
  /\ WorldReady(a) /\ hazard = 0 /\ 2 \in Hazards /\ env.stage = 0 /\ env.retry = NoCmd
  /\ LET request == IF which = 1 THEN env.last ELSE env.previous
     IN /\ request # NoCmd
        /\ EnvironmentFor(2,[EmptyEnvironment EXCEPT !.retry = request, !.stage = 1])
DelayReply(a) ==
  \/ /\ WorldReady(a) /\ hazard = 0 /\ env.stage = 0
     /\ env.reply = 1 /\ env.delayed = NoCmd /\ env.last # NoCmd
     /\ \E h \in {3,4} \cap Hazards:
          EnvironmentFor(h,[EmptyEnvironment EXCEPT !.delayed = env.last, !.reply = 2,
              !.last = IF h = 4 THEN env.last ELSE NoCmd,
              !.samples = IF h = 4 THEN env.samples ELSE 0,
              !.stage = IF h = 3 THEN 2 ELSE 1])
  \/ /\ WorldReady(a) /\ hazard \in {3,4} /\ env.stage = 2
     /\ env.delayed # NoCmd
     /\ EnvironmentFor(hazard,[env EXCEPT !.delivered = env.delayed,
                               !.delayed = NoCmd, !.reply = 3])
ReorderReplies(a) ==
  /\ WorldReady(a) /\ hazard = 4 /\ env.stage = 1 /\ env.delayed # NoCmd /\ env.reply = 1
  /\ env.last # env.delayed
  /\ EnvironmentFor(4,[EmptyEnvironment EXCEPT !.delivered = env.last, !.last = env.last, !.delayed = env.delayed, !.reply = 3, !.stage = 2])
FailForever(a) ==
  /\ WorldReady(a) /\ hazard = 0 /\ 5 \in Hazards /\ env.stage = 0 /\ env.last # NoCmd
  /\ EnvironmentFor(5,[EmptyEnvironment EXCEPT !.mode = 2, !.reply = 5, !.stage = 2])
FailThenSucceed(a) ==
  /\ WorldReady(a) /\ hazard = 0 /\ 6 \in Hazards /\ env.stage = 0 /\ env.mode = 0 /\ env.last # NoCmd
  /\ EnvironmentFor(6,[EmptyEnvironment EXCEPT !.mode = 1, !.reply = 5, !.failure = 1, !.stage = 1])
CrashActor(a) ==
  /\ WorldReady(a) /\ hazard = 0 /\ 7 \in Hazards /\ env.stage = 0 /\ env.last # NoCmd
  /\ EnvironmentFor(7,[EmptyEnvironment EXCEPT !.mode = 3, !.stage = 2])
GoSilent(a) ==
  /\ WorldReady(a) /\ hazard = 0 /\ 8 \in Hazards /\ env.stage = 0 /\ env.reply = 1 /\ env.last # NoCmd
  /\ EnvironmentFor(8,[EmptyEnvironment EXCEPT !.mode = 4, !.last = env.last, !.reply = 1, !.stage = 2])
QaDrop(which) == DropReply(1,which)
QaDuplicate(which) == DuplicateRequest(1,which)
QaDelay == DelayReply(1)
QaReorder == ReorderReplies(1)
QaForever == FailForever(1)
QaRecover == FailThenSucceed(1)
QaCrash == CrashActor(1)
QaSilent == GoSilent(1)
SalesDrop(which) == DropReply(2,which)
SalesDuplicate(which) == DuplicateRequest(2,which)
SalesDelay == DelayReply(2)
SalesReorder == ReorderReplies(2)
SalesForever == FailForever(2)
SalesRecover == FailThenSucceed(2)
SalesCrash == CrashActor(2)
SalesSilent == GoSilent(2)
PickerDrop(which) == DropReply(3,which)
PickerDuplicate(which) == DuplicateRequest(3,which)
PickerDelay == DelayReply(3)
PickerReorder == ReorderReplies(3)
PickerForever == FailForever(3)
PickerRecover == FailThenSucceed(3)
PickerCrash == CrashActor(3)
PickerSilent == GoSilent(3)
CustomerDrop(which) == DropReply(4,which)
CustomerDuplicate(which) == DuplicateRequest(4,which)
CustomerDelay == DelayReply(4)
CustomerReorder == ReorderReplies(4)
CustomerForever == FailForever(4)
CustomerRecover == FailThenSucceed(4)
CustomerCrash == CrashActor(4)
CustomerSilent == GoSilent(4)
CarrierDrop(which) == DropReply(5,which)
CarrierDuplicate(which) == DuplicateRequest(5,which)
CarrierDelay == DelayReply(5)
CarrierReorder == ReorderReplies(5)
CarrierForever == FailForever(5)
CarrierRecover == FailThenSucceed(5)
CarrierCrash == CrashActor(5)
CarrierSilent == GoSilent(5)
FinanceDrop(which) == DropReply(6,which)
FinanceDuplicate(which) == DuplicateRequest(6,which)
FinanceDelay == DelayReply(6)
FinanceReorder == ReorderReplies(6)
FinanceForever == FailForever(6)
FinanceRecover == FailThenSucceed(6)
FinanceCrash == CrashActor(6)
FinanceSilent == GoSilent(6)
=============================================================================
