use Test;
use Kintsugi::MockEvaluator;
use Kintsugi::AST;
use X::Kintsugi::Errors;

plan 4;

is run('add: function [a b] [a + b] add 3 4').value, 7, 'basic function call';
is run('f: function [x] [x + x] f 5').value, 10, 'function returns computed value';
throws-like { run('f: function [a b] [a + b] f 1') }, X::Kintsugi::ArityError, 'too few args raises ArityError';
throws-like { run('function [a a] [a]') }, X::Kintsugi::DuplicateParam, 'duplicate params raises DuplicateParam';
