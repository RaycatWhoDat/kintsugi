use Test;
use Kintsugi::MockEvaluator;
use Kintsugi::AST;
use X::Kintsugi::Errors;

plan 7;

is run('do [1 + 2]').value, 3, 'do evaluates block';
throws-like { run('do 42') }, X::Kintsugi::TypeError, 'do on non-block is TypeError';

my $composed = run('compose [1 (2 + 3) 4]');
ok $composed ~~ AST::Block, 'compose returns a block';
is $composed.items[1].value, 5, 'compose evaluates parens';

throws-like { run('compose "hello"') }, X::Kintsugi::TypeError, 'compose on non-block is TypeError';

my $nested = run('compose [1 [2 (3 + 4)] 5]');
ok $nested.items[1].items[1] ~~ AST::Paren, 'nested block parens stay inert in compose';

is run('do compose [1 (2 + 3) 4]').value, 4, 'do compose round-trip returns last value';
