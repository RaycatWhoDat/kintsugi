use lib 'lib';
use Kintsugi::Foundation::Grammar;
use Kintsugi::Standard::Grammar;
use Kintsugi::Actions;

class X::Kintsugi::StartupError is Exception {
    method message { "There was an error during startup." }
}

class X::Kintsugi::ParseError is Exception {
    method message { "There was an error during parsing." }
}

sub MAIN(IO(Str) $file where *.f) {
    say "=== Kintsugi Compiler v0.0.1 ===";

    say "Compiling: {$file.basename}";
    my $input-file = $file.slurp;
    my $grammar = do given $input-file {
        when / ^^ 'Kintsugi/Foundation' <.ws> / { Kintsugi::Foundation::Grammar }
        when / ^^ 'Kintsugi' <.ws> / { Kintsugi::Standard::Grammar }
    }
    
    my $parsed-file = $grammar.parse($input-file, actions => Kintsugi::Actions);
    die X::Kintsugi::ParseError.new if not so $parsed-file;
    say $parsed-file;

    CATCH {
        when X::Kintsugi {
            .message.note;
            exit;
        }
    }
}
