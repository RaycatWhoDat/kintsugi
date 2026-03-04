# Kintsugi

A homoiconic, dynamically-typed programming language with rich built-in datatypes, compile-time evaluation, and extensible DSLs called "dialects". Influenced by REBOL, Red, Ren-C, Common Lisp, D, and Raku.

> [!WARNING]
> Kintsugi is in early development. Things can and will change. Things will break. Use at your own risk.

```rebol
Kintsugi/Core []

; ═══════════════════════════════════════════
; 1. Scalars, Variables, Arithmetic
; ═══════════════════════════════════════════

x: 10
y: 3
print x + y          ; 13
print x - y          ; 7
print x * y          ; 30
print x / y          ; 3.333333
print x % y          ; 1
print 2 * 2 * 2 * 2  ; 16

pi: 3.14159
print pi * 2         ; 6.28318

; ═══════════════════════════════════════════
; 2. Comparisons and Logic
; ═══════════════════════════════════════════

print 5 > 3          ; True
print 5 < 3          ; False
print 5 = 5          ; True
print 5 <> 3         ; True
print 5 >= 5         ; True
print 3 <= 5         ; True

print not 1 = 2      ; True
print 1 = 1 and 2 = 2  ; True
print 1 = 2 or 2 = 2   ; True

; ═══════════════════════════════════════════
; 3. Functions
; ═══════════════════════════════════════════

add: function [a b] [a + b]
print add 3 4        ; 7

; Higher-order — pass functions with get-word
double: function [n] [n * 2]
print apply :double [21]    ; 42

; Early return
clamp: function [val lo hi] [
  if val < lo [return lo]
  if val > hi [return hi]
  val
]
print clamp 5 0 10    ; 5
print clamp -3 0 10   ; 0
print clamp 99 0 10   ; 10

; ═══════════════════════════════════════════
; 4. Blocks as Data
; ═══════════════════════════════════════════

data: [10 20 30 40 50]

print length? data       ; 5
print empty? []          ; True
print pick data 3        ; 30
print first data         ; 10
print last data          ; 50

; Pick returns none for out-of-range
print none? pick data 99 ; True

; Compose — evaluate parens inside blocks
template: compose [result is (3 + 4)]
probe template           ; result is 7

; Do — evaluate a block as code
print do [1 + 2 * 3]    ; 9

; ═══════════════════════════════════════════
; 5. Block Mutation
; ═══════════════════════════════════════════

buf: [1 2 3]
append buf 4
print length? buf        ; 4

insert buf 1 0
print pick buf 1         ; 0

remove buf 1
print pick buf 1         ; 1

reverse buf
print pick buf 1         ; 4

; Copy creates an independent block
original: [1 2 3]
clone: copy original
append clone 99
print length? original   ; 3

; Select — key-value lookup in flat blocks
config: [width 800 height 600 depth 32]
print select config 'width   ; 800
print select config 'depth   ; 32

; ═══════════════════════════════════════════
; 6. Control Flow
; ═══════════════════════════════════════════

; If — evaluates block when condition is truthy
print if 1 [42]          ; 42
print none? if 0 [42]    ; True (0 is falsy)

; Either — two branches
sign: function [n] [
  either n > 0 [1] [
    either n < 0 [-1] [0]
  ]
]
print sign 99            ; 1
print sign -5            ; -1
print sign 0             ; 0

; While — loop with condition block
n: 1
factorial: 1
while [n <= 5] [
  factorial: factorial * n
  n: n + 1
]
print factorial          ; 120

; Until — loop until body returns truthy
counter: 0
until [
  counter: counter + 1
  counter = 10
]
print counter            ; 10

; Loop — repeat N times
sum: 0
loop 100 [sum: sum + 1]
print sum                ; 100

; Break — exit loop early
total: 0
n: 0
while [n < 1000] [
  n: n + 1
  if n > 10 [break]
  total: total + n
]
print total              ; 55

; ═══════════════════════════════════════════
; 7. Iteration
; ═══════════════════════════════════════════

; Each — iterate a block
sum: 0
each [x] [1 2 3 4 5] [
  sum: sum + x
]
print sum                ; 15

; Each with stride-2 (key/value pairs)
each [k v] [x 10 y 20 z 30] [
  probe k
  print v
]

; Map — transform each element
squares: map [n] [1 2 3 4 5] [n * n]
probe squares            ; 1 4 9 16 25

; Filter — keep elements matching a predicate
evens: filter [n] [1 2 3 4 5 6 7 8] [even? n]
probe evens              ; 2 4 6 8

; Reduce — fold a block into a single value
total: reduce [acc x] [1 2 3 4 5 6 7 8 9 10] [acc + x]
print total              ; 55

; Break inside iteration
partial: map [x] [1 2 3 4 5] [
  if x = 4 [break]
  x * 10
]
probe partial            ; 10 20 30

; ═══════════════════════════════════════════
; 8. Type Predicates
; ═══════════════════════════════════════════

print type? 42           ; integer!
print type? 3.14         ; float!
print type? [1 2]        ; block!
print type? none         ; none!

print integer? 42        ; True
print float? 3.14        ; True
print block? [1 2 3]     ; True
print none? none         ; True

f: function [x] [x]
print function? :f       ; True

; ═══════════════════════════════════════════
; 9. Error Handling
; ═══════════════════════════════════════════

; Try catches errors and returns none
safe: try [1 + 2]
print safe               ; 3

broken: try [undefined-word]
print none? broken       ; True

; ═══════════════════════════════════════════
; 10. Utility Words
; ═══════════════════════════════════════════

print min 3 7            ; 3
print max 3 7            ; 7
print abs -42            ; 42
print negate 5           ; -5
print odd? 7             ; True
print even? 8            ; True

; Probe — prints and returns (debug pipelines)
result: probe (6 * 7)    ; prints 42
print result             ; 42

; ═══════════════════════════════════════════
; 11. Putting It All Together
; ═══════════════════════════════════════════

; Quicksort
qsort: function [blk] [
  if (length? blk) <= 1 [return blk]
  pivot: first blk
  rest: copy blk
  remove rest 1
  lo: filter [x] rest [x < pivot]
  hi: filter [x] rest [not x < pivot]
  result: qsort lo
  append result pivot
  each [x] qsort hi [append result x]
  result
]

unsorted: [3 1 4 1 5 9 2 6 5 3]
sorted: qsort unsorted
probe sorted             ; 1 1 2 3 3 4 5 5 6 9

; Fibonacci sequence
fib: function [n] [
  seq: [0 1]
  loop (n - 2) [
    a: pick seq ((length? seq) - 1)
    b: last seq
    append seq (a + b)
  ]
  seq
]

probe fib 10             ; 0 1 1 2 3 5 8 13 21 34
```


