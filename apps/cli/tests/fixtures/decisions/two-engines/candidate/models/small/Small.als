module Small
sig Request {}
pred Advance { some Request }
pred Wait { some Request }
