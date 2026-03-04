use Kintsugi::Grammar;
use Kintsugi::Actions;
use Kintsugi::Evaluator;
use X::Kintsugi::Errors;

sub MAIN(IO(Str) $file where *.f) {
    say "=== Kintsugi Interpreter v0.0.1 ===";
    say "Entry point: {$file.basename}";

    my $header-line = $file.lines.first(*.starts-with('Kintsugi')) // '';
    my $grammar = do given $header-line {
        when / 'Kintsugi/Core' / { Kintsugi::Grammar::Core }
        when / 'Kintsugi/Systems' / { Kintsugi::Grammar::Systems }
        when / 'Kintsugi' '/Full'? / { Kintsugi::Grammar::Full }
        default {
            die X::Kintsugi::UnknownDialectError.new(message => "Did not see a valid dialect in the header.");
        }
    }
    
    my $source = $file.slurp;
    my $parsed-file = $grammar.parse($source, actions => Kintsugi::Actions);
    unless so $parsed-file {
        my $partial = $grammar.subparse($source);
        my $pos = $partial ?? $partial.to !! 0;
        my $line = $source.substr(0, $pos).split("\n").elems;
        my $near = $source.substr($pos, 40).split("\n")[0];
        die X::Kintsugi::ParseError.new(message => "Parse error at line $line, near: \"$near\"");
    }

    my $ast = $parsed-file.made;
    my $evaluator = Kintsugi::Evaluator.new(source => $source, tier => $ast.header.tier);
    $evaluator.run($ast);
    
    CATCH {
        when X::Kintsugi {
            .gist.say;
            exit;
        } 
    }
}
