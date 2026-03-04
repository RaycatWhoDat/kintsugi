unit module Kintsugi::MockEvaluator;

use Kintsugi::Grammar;
use Kintsugi::Actions;
use Kintsugi::Evaluator;
use X::Kintsugi::Errors;

sub run(Str $code, Str :$tier = 'Kintsugi') is export {
    my $source = "{$tier} []\n{$code}";
    my $grammar = do given $tier {
        when 'Kintsugi/Core'    { Kintsugi::Grammar::Core }
        when 'Kintsugi/Systems' { Kintsugi::Grammar::Systems }
        default                  { Kintsugi::Grammar::Full }
    };
    my $parsed = $grammar.parse($source, actions => Kintsugi::Actions);
    die X::Kintsugi::ParseError.new(message => "Parse failed") unless $parsed;
    my $ast = $parsed.made;
    my $runner = Kintsugi::Evaluator.new(source => $source, tier => $ast.header.tier);
    $runner.run($ast);
}
