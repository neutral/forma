module Door
one sig DoorState { var closed: set DoorState }
fact Initial { no DoorState.closed }
fact Steps { always (Close or DoorState.closed' = DoorState.closed) }
pred Close { no DoorState.closed and DoorState.closed' = DoorState }
