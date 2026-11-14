\* The completed flag and receipt field retain this key's original durable
\* result. A retry sent before completion is still subject to the obligation
\* if completion wins before the retry executes. There is no expiry exception.
\* Changes to retry state identify effects, without naming a row's operator.
Property ==
  [][\A k \in Keys :
       LET retryMoves ==
             \/ requests'[k].retryAvailable # requests[k].retryAvailable
             \/ requests'[k].retryCompleted # requests[k].retryCompleted
             \/ requests'[k].retryReceipt # requests[k].retryReceipt
             \/ requests'[k].retryReplied # requests[k].retryReplied
             \/ (k \in recipient'.retrySent /\ k \notin recipient.retrySent)
       IN /\ ((requests[k].completed /\ retryMoves) =>
                /\ requests'[k].completed
                /\ requests'[k].receipt = requests[k].receipt
                /\ requests[k].receipt \in receipts'
                /\ audit.created' = audit.created
                /\ ticket.claimed' = ticket.claimed)
          \* replies records actual deliveries for this key, including delayed
          \* and copied replies, and excludes fetches and failed attempts.
          /\ (requests'[k].completed =>
                recipient'.replies[k] \subseteq {requests'[k].receipt})]_vars
