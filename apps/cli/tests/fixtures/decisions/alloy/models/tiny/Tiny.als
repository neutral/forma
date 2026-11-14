module Tiny
var sig Flag {}
pred Observe { Flag' = Flag }
fact Behavior { no Flag and always Observe }
