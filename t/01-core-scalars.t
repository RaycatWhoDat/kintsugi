use Test;
use Kintsugi::MockEvaluator;
use Kintsugi::AST;

plan 9;

is run('42').value, 42, 'integer literal';
is run('-7').value, -7, 'negative integer';
is run('3.14').value, 3.14, 'float literal';
is run('#"A"').value, 'A', 'char literal';
is run('true').value, True, 'logic true';
is run('false').value, False, 'logic false';
ok run('none') ~~ AST::None, 'none literal';
is run('"hello"').value, 'hello', 'string literal';
is run('(1 + 2)').value, 3, 'paren evaluates immediately';
