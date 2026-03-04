use Test;
use Kintsugi::MockEvaluator;
use Kintsugi::AST;

plan 12;

# form — converts any value to string; blocks join with spaces
is run('form [hello world]').value, 'hello world', 'form joins block words with spaces';
is run('form [(1 + 2) world]').value, '1 + 2 world', 'form stringifies parens without evaluating';
is run('form 42').value, '42', 'form converts integer to string';
is run('form "hello"').value, 'hello', 'form on string returns string';

# reform — reduces (evaluates) block, then forms with spaces
is run('reform ["answer is" 40 + 2]').value, 'answer is 42', 'reform reduces then forms with spaces';
is run('x: 10 reform ["x =" x]').value, 'x = 10', 'reform evaluates words in block';

# rejoin — reduces block, joins without spaces
is run('rejoin ["a" 1 + 2 "b"]').value, 'a3b', 'rejoin reduces and concatenates without spaces';
is run('name: "world" rejoin ["hello " name]').value, 'hello world', 'rejoin evaluates words';

# join — concatenates; type follows first arg
is run('join "hello" "world"').value, 'helloworld', 'join concatenates strings';
is run('join "num: " 42').value, 'num: 42', 'join string + integer';

my $joined-blocks = run('join [1 2] [3 4]');
is $joined-blocks.items.elems, 4, 'join merges two blocks';

my $joined-scalar = run('join [1 2] 99');
is $joined-scalar.items.elems, 3, 'join appends scalar to block';
