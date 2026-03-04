use Test;
use Kintsugi::MockEvaluator;
use Kintsugi::AST;
use X::Kintsugi::Errors;

plan 12;

# return — early exit from function
is run('f: function [x] [if x > 0 [return 99] x + 1] f 5').value, 99, 'return early-exits function';
is run('f: function [x] [if x > 0 [return 99] x + 1] f -1').value, 0, 'function runs normally when return not hit';

# apply — call function with block as arg list
is run('add: function [a b] [a + b] apply :add [3 4]').value, 7, 'apply calls function with block args';
is run('apply :print [42]').value, 42, 'apply works with native functions';

# min / max
is run('min 3 7').value, 3, 'min returns lesser';
is run('max 3 7').value, 7, 'max returns greater';

# abs / negate
is run('abs -5').value, 5, 'abs of negative';
is run('abs 5').value, 5, 'abs of positive';
is run('negate 5').value, -5, 'negate flips sign';

# odd? / even?
is run('odd? 3').value, True, 'odd? on 3';
is run('even? 4').value, True, 'even? on 4';

# probe — prints and returns (just check return value)
my $probed = run('probe 42');
is $probed.value, 42, 'probe returns its argument';
