use Test;
use Kintsugi::MockEvaluator;
use Kintsugi::AST;
use X::Kintsugi::Errors;

plan 12;

# if
is run('if true [42]').value, 42, 'if true evaluates body';
ok run('if false [42]') ~~ AST::None, 'if false returns none';

# either
is run('either true [1] [2]').value, 1, 'either true returns first branch';
is run('either false [1] [2]').value, 2, 'either false returns second branch';

# while
is run('n: 0 while [n < 3] [n: n + 1] n').value, 3, 'while loops until condition false';

# until
is run('n: 0 until [n: n + 1 n > 2]').value, True, 'until loops until body returns truthy';

# loop
is run('n: 0 loop 3 [n: n + 1] n').value, 3, 'loop repeats n times';

# break
is run('n: 0 while [true] [n: n + 1 if n = 3 [break]] n').value, 3, 'break exits while loop';
is run('n: 0 loop 100 [n: n + 1 if n = 5 [break]] n').value, 5, 'break exits loop';

# nested
is run('either true [if true [99]] [0]').value, 99, 'nested either/if';
is run('either false [0] [if true [88]]').value, 88, 'nested either false branch with if';

# if with comparison (infix lookahead)
is run('if 3 > 1 [42]').value, 42, 'if with infix comparison';
