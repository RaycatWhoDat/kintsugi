use Test;
use Kintsugi::MockEvaluator;
use Kintsugi::AST;
use X::Kintsugi::Errors;

plan 11;

# each — iterates, returns last body result
is run('n: 0 each [x] [1 2 3] [n: n + x] n').value, 6, 'each sums values';

# each with stride-2
is run('n: 0 each [k v] [a 1 b 2] [n: n + v] n').value, 3, 'each stride-2 sums values';

# map — collects body results into new block
my $mapped = run('map [x] [1 2 3] [x + 10]');
ok $mapped ~~ AST::Block, 'map returns a block';
is $mapped.items[0].value, 11, 'map first item';
is $mapped.items[2].value, 13, 'map last item';

# filter — keeps items where body is truthy
my $filtered = run('filter [x] [1 2 3 4 5] [x > 3]');
ok $filtered ~~ AST::Block, 'filter returns a block';
is $filtered.items.elems, 2, 'filter keeps 2 items';
is $filtered.items[0].value, 4, 'filter first kept item';

# reduce — fold with accumulator
is run('reduce [acc x] [1 2 3 4] [acc + x]').value, 10, 'reduce sums to 10';

# break inside each
is run('n: 0 each [x] [1 2 3 4 5] [if x = 3 [break] n: n + x] n').value, 3, 'break exits each';

# empty series
my $empty-map = run('map [x] [] [x + 1]');
is $empty-map.items.elems, 0, 'map on empty series returns empty block';
