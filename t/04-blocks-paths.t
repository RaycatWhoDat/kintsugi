use Test;
use Kintsugi::MockEvaluator;
use Kintsugi::AST;
use X::Kintsugi::Errors;

plan 6;

ok run('[1 2 3]') ~~ AST::Block, 'block literal is inert';
is run('[1 2 3]').items.elems, 3, 'block has correct item count';
is run('list: [10 20 30] list/2').value, 20, 'path indexing is 1-based';
is run('list: [10 20 30] list/2: 99 list/2').value, 99, 'set-path modifies block';
throws-like { run('list: [10 20 30] list/4') }, X::Kintsugi::TypeError, message => /'out of range'/, 'out-of-range path index';
throws-like { run('x: 42 x/1') }, X::Kintsugi::TypeError, message => /'Cannot index'/, 'path on non-block is type error';
