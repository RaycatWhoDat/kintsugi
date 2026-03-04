use Test;
use Kintsugi::MockEvaluator;

plan 14;

# Arithmetic
is run('1 + 2').value, 3, 'addition';
is run('4 * 5').value, 20, 'multiplication';
is run('10 - 3').value, 7, 'subtraction';
is run('10 / 2').value, 5, 'division';
is run('10 % 3').value, 1, 'modulo';

# Comparison
is run('3 > 1').value, True, 'greater than (true)';
is run('1 > 3').value, False, 'greater than (false)';
is run('3 >= 3').value, True, 'greater or equal';
is run('1 = 1').value, True, 'equality (true)';
is run('1 = 2').value, False, 'equality (false)';
is run('1 <> 2').value, True, 'not equal (true)';
is run('1 < 3').value, True, 'less than';
is run('1 <= 2').value, True, 'less or equal';

# Chaining
is run('1 + 2 + 3').value, 6, 'chained addition';
