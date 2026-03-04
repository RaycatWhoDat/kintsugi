use Test;
use Kintsugi::MockEvaluator;

plan 5;

is run('x: 42 x').value, 42, 'set-word assigns, word retrieves';
is run('x: 42 :x').value, 42, 'get-word returns value without calling';
is run("'hello"), 'hello', 'lit-word returns name string';
is run('x: 1 f: function [x] [x] f 99').value, 99, 'function param shadows outer variable';
is run('x: 1 f: function [y] [y] f 99 x').value, 1, 'outer scope preserved after function call';
