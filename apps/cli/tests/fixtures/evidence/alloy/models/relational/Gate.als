module Gate

abstract sig Phase {}
one sig closed, opened extends Phase {}

one sig Ticket {
  var count: one Int
}

pred Open {
  Ticket.count = 0
  Ticket.count' = 1
}

pred Reset {
  Ticket.count' = 0
}

fun DoorPhase[t: Ticket]: one Phase {
  t.count = 1 => opened else closed
}

fact Behaviour {
  Ticket.count = 0
  always (Open or Reset)
}
