module core

abstract sig Phase {}
one sig idle, done extends Phase {}
one sig Thing { var phase: one Phase }

pred Step { Thing.phase' = done }

fact Behavior {
  Thing.phase = idle
  always (Step or Thing.phase' = Thing.phase)
}
