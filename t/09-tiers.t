use Test;
use Kintsugi::MockEvaluator;
use Kintsugi::AST;
use X::Kintsugi::Errors;

plan 5;

# Core tier: compose and do are available
is run('do [1 + 2]', tier => 'Kintsugi/Core').value, 3, 'Core tier has do';
ok run('compose [1 (2 + 3)]', tier => 'Kintsugi/Core') ~~ AST::Block, 'Core tier has compose';

# Core tier: Systems words are NOT available
throws-like { run('form [1 2]', tier => 'Kintsugi/Core') }, X::Kintsugi::UndefinedWord, 'Core tier lacks form';

# Systems tier: form is available
is run('form [1 2]', tier => 'Kintsugi/Systems').value, '1 2', 'Systems tier has form';

# Bare Kintsugi loads Systems words
is run('form [1 2]').value, '1 2', 'bare Kintsugi tier loads Systems words';
