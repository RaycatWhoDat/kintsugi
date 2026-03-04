use Test;
use Kintsugi::MockEvaluator;
use X::Kintsugi::Errors;

plan 3;

throws-like { run('do 42') }, X::Kintsugi::TypeError,
    message => /do .* 'block!' .* 'integer!'/,
    'do type error mentions word name and types';

throws-like { run('compose "hello"') }, X::Kintsugi::TypeError,
    message => /compose .* 'block!' .* 'string!'/,
    'compose type error mentions word name and types';

throws-like { run('do "hello"') }, X::Kintsugi::TypeError,
    message => /'block!' .* 'string!'/,
    'type error includes expected and got types';
