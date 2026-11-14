module Ticket
abstract sig Phase {}
one sig idle, done extends Phase {}
one sig Ticket { var phase: one Phase }
pred Finish { Ticket.phase' = done }
fact Initial { Ticket.phase = idle }
fact Transitions { always Finish }
