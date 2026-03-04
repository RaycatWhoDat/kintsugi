use Test;
use Kintsugi::MockEvaluator;
use Kintsugi::AST;
use X::Kintsugi::Errors;

plan 17;

# length? / empty?
is run('length? [1 2 3]').value, 3, 'length? of 3-item block';
is run('length? []').value, 0, 'length? of empty block';
is run('empty? []').value, True, 'empty? on empty block';
is run('empty? [1]').value, False, 'empty? on non-empty block';

# pick / first / last (1-based indexing)
is run('pick [10 20 30] 2').value, 20, 'pick at index 2';
ok run('pick [10 20] 5') ~~ AST::None, 'pick out of range returns none';
is run('first [10 20]').value, 10, 'first item';
is run('last [10 20]').value, 20, 'last item';

# append (mutating)
is run('b: [1 2] append b 3 length? b').value, 3, 'append adds item and mutates';

# insert (mutating, 1-based)
is run('b: [1 3] insert b 2 99 pick b 2').value, 99, 'insert at index 2';

# remove (mutating, 1-based)
is run('b: [1 2 3] remove b 2 length? b').value, 2, 'remove shrinks block';
is run('b: [1 2 3] remove b 2 pick b 2').value, 3, 'remove shifts items down';

# copy (shallow, independent)
my $result = run('a: [1 2 3] b: copy a append b 99 length? a');
is $result.value, 3, 'copy creates independent block';

# reverse (mutates in-place)
is run('b: [1 2 3] reverse b pick b 1').value, 3, 'reverse mutates block in-place';
is run('b: [1 2 3] reverse b pick b 3').value, 1, 'reverse last item is 1';

# select (value equality)
is run("select [a 1 b 2] 'a").value, 1, 'select finds value after key';
is run('select [1 "one" 2 "two"] 2').value, 'two', 'select with integer key';
