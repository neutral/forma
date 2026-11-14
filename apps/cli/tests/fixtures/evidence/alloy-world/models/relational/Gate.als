module Gate

abstract sig Phase {}
one sig closed, opened extends Phase {}

one sig Ticket {
  var count: one Int,
  var last: one Int
}

pred Open {
  Ticket.count = 0
  Ticket.count' = 1
  Ticket.last' = Ticket.last
}

pred Reset {
  Ticket.count' = 0
  Ticket.last' = Ticket.last
}

pred Drop {
  Ticket.count' = Ticket.count
  Ticket.last' = 1
}

pred Duplicate {
  Ticket.count' = Ticket.count
  Ticket.last' = 2
}

pred Delay {
  Ticket.count' = Ticket.count
  Ticket.last' = 3
}

pred Reorder {
  Ticket.count' = Ticket.count
  Ticket.last' = 4
}

pred FailForever {
  Ticket.count' = Ticket.count
  Ticket.last' = 5
}

pred FailThenSucceed {
  Ticket.count' = Ticket.count
  Ticket.last' = 6
}

pred Crash {
  Ticket.count' = Ticket.count
  Ticket.last' = 7
}

pred GoSilent {
  Ticket.count' = Ticket.count
  Ticket.last' = 8
}

fun DoorPhase[t: Ticket]: one Phase {
  t.count = 1 => opened else closed
}

fact Behaviour {
  Ticket.count = 0
  Ticket.last = 0
  always (Open or Reset or Drop or Duplicate or Delay or Reorder
    or FailForever or FailThenSucceed or Crash or GoSilent)
}
