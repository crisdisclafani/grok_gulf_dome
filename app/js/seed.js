// Deterministic PRNG so every run (and every capture worker) builds an identical world.
let s = 0x9E3779B9 >>> 0;
Math.random = function(){ s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
