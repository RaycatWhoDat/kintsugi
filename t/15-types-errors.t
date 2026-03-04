use Test;
use Kintsugi::MockEvaluator;
use Kintsugi::AST;

plan 15;

# type?
is run('type? 42').value, 'integer!', 'type? integer';
is run('type? 3.14').value, 'float!', 'type? float';
is run('type? true').value, 'logic!', 'type? logic';
is run('type? "hello"').value, 'string!', 'type? string';
is run('type? [1 2]').value, 'block!', 'type? block';
is run('type? none').value, 'none!', 'type? none';
is run('f: function [x] [x] type? :f').value, 'function!', 'type? function';

# predicates
is run('integer? 42').value, True, 'integer? true';
is run('integer? "no"').value, False, 'integer? false';
is run('none? none').value, True, 'none? true';
is run('block? [1 2]').value, True, 'block? true';
is run('logic? true').value, True, 'logic? true';
is run('function? :print').value, True, 'function? on native word';

# try
is run('try [1 + 2]').value, 3, 'try returns value on success';
ok run('try [foobar]') ~~ AST::None, 'try returns none on error';
