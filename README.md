# Kintsugi

A simple, powerful scripting language aimed at glue scripts and game dev. Rich built-in types, gradual typing, and dialects (embedded DSLs) for loops, parsing, pattern matching, and objects.

> [!CAUTION]
> This language is in active development. Things will break and explode.

```
Person: object [
  name [string!]
  age [integer!]
  greet: function [] [
    rejoin ["Hi, I'm " self/name " age " self/age]
  ]
]

p: make-person "Ray" 30
print p/greet                           ; Hi, I'm Ray age 30
```

## Features

- **26 built-in types** including `money!` (exact cents), `pair!`, `date!`, `time!`, `url!`, `email!`
- **Gradual typing** with `[type!]` annotations, `opt`, custom `@type`, structural types, `@type/enum`
- **Object dialect** with prototypes, `make` cloning, auto-generated constructors and type names
- **Parse dialect** for pattern matching on strings and blocks
- **Loop dialect** with `for/in`, `from/to`, guards, `collect`, `fold`, `partition`
- **No operator precedence** -- left-to-right evaluation, parens for grouping
- **Three-tier compiler** targeting Lua (more backends planned)

## Quick Start

```bash
# Run a file
bun run src/interpreter.ts examples/script-spec.ktg

# REPL
bun run src/interpreter.ts

# Run tests
bun test
```

## Learn Kintsugi

The language spec is a single executable file that doubles as the documentation:

**[`examples/script-spec.ktg`](examples/script-spec.ktg)**

It covers everything: types, functions, control flow, dialects, objects, error handling, the module system, and gotchas for developers coming from C-style or REBOL-style languages. Because it's `.ktg`, it's tested -- if the docs are wrong, the tests fail.

## Lineage

Influenced by REBOL, Red, Ren-C, Common Lisp, D, Python, Lua, Kotlin, Ruby, and Raku.
