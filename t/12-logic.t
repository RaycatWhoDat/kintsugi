use Test;
use Kintsugi::MockEvaluator;
use Kintsugi::AST;

plan 8;

# not
is run('not true').value, False, 'not true is false';
is run('not false').value, True, 'not false is true';

# and (infix)
is run('true and true').value, True, 'true and true';
is run('true and false').value, False, 'true and false';

# or (infix)
is run('true or false').value, True, 'true or false';
is run('false or false').value, False, 'false or false';

# combined
is run('not (true and false)').value, True, 'not (true and false)';
is run('3 > 1 and 5 < 10').value, True, 'comparisons with and';
