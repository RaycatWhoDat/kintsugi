use X::Kintsugi::Errors;

grammar Kintsugi::Grammar::Core {
    method FAILGOAL($goal) {
        my $pos = self.pos;
        my $line = self.orig.substr(0, $pos).split("\n").elems;
        my $near = self.orig.substr($pos, 40).split("\n")[0].trim;
        my $message = $near.chars > 0
            ?? "Unexpected \"$near\" at line $line (expected $goal)"
            !! "Missing closing $goal at line $line";
        die X::Kintsugi::ParseError.new(:$message);
    }
    
    rule TOP { <preamble>? <header> <block-items> }

    token preamble { [<.ws> <comment> <.ws>]+ }

    rule header { 'Kintsugi/Core' <.ws> <block> }
    
    rule block { '[' ~ ']' <block-items> }
    token block-items { <datatype>* % <.ws> }

    proto token datatype { * }
    token datatype:sym<block> { <block> }
    token datatype:sym<directive> { <directive> }
    token datatype:sym<file> { <file> }
    token datatype:sym<comment> { <comment> }
    token datatype:sym<lit-word> { <lit-word> }
    token datatype:sym<set-path> { <set-path> }
    token datatype:sym<get-path> { <get-path> }
    token datatype:sym<path>     { <path> }
    token datatype:sym<get-word> { <get-word> }
    token datatype:sym<set-word> { <set-word> }
    token datatype:sym<float> { <float> }
    token datatype:sym<integer> { <integer> }
    token datatype:sym<none> { <sym> }
    token datatype:sym<word> { <word> }
    token datatype:sym<function> { <function> }
    token datatype:sym<operator> { <operator> }
    token datatype:sym<char> { <char> }
    token datatype:sym<binary> { <binary> }
    token datatype:sym<paren> { <paren> }

    token directive {
        '#'
        < comptime >
    }
    
    token file { '%' <any-safe-file-char>+ }
    token function { 'function' <.ws> <block> <.ws> <block> }
    token operator { '->' | '<=' | '>=' | '<>' | 'and' >> | 'or' >> | <[+\-*/\^=\<\>%]> }
    
    token lit-word { '\'' <word> }
    token get-word { ':' <word> }
    token set-word { <word> ':' }
    token word { <any-word-char>+ [ '-' <any-word-char>+ ]* }

    token path { $<head>=<word> <path-segment>+ }
    token path-segment { '/' [ $<index>=[\d+] | $<key>=<word> ] }
    token set-path { <path> ':' }
    token get-path { ':' <path> }

    token float { '-'? \d* '.' \d+ }
    token integer { '-'? \d+ }
    token char { '#"' \w '"' }
    token binary { '#{' <[0..9 A..F a..f]>+ '}' }
    rule paren { '(' ~ ')' <block-items> }

    token comment { ';' \N* }

    token string-contents { <-["]>* }
    token strictly-word-char { <[\w\-]> }
    token any-safe-file-char { <[\w\-\/\.]> }
    token any-word-char { <[\w?_!~]> }
    token any-char { . }
}

grammar Kintsugi::Grammar::Systems is Kintsugi::Grammar::Core {
    rule header { 'Kintsugi/Systems' <.ws> <block> }

    token datatype:sym<string> { <string> }
    token datatype:sym<logic> { <logic> }
    # token datatype:sym<tag> { <tag> }
    token datatype:sym<url> { <url> }
    token datatype:sym<email> { <email> }

    token string { '"' ~ '"' <string-contents> }
    token logic { < true false > }
    # token tag { '<' <-[>]>+ '>' }
    token url { <[a..z]>+ '://' <[\w\-./~:?#\[\]@!$&()*+,;=%]>+ }
    token email { <[\w.\-]>+ '@' <[\w.\-]>+ }
}

grammar Kintsugi::Grammar::Full is Kintsugi::Grammar::Systems {
    rule header { 'Kintsugi' '/Full'? <.ws> <block> }

    token datatype:sym<date> { <date> }
    token datatype:sym<time> { <time> }
    token datatype:sym<pair> { <pair> }
    token datatype:sym<money> { <money> }
    token datatype:sym<tuple> { <tuple> }
    token datatype:sym<logic> { <logic> }

    token date {
        | \d ** 4 '-' \d ** 2 '-' \d ** 2
        | \d ** 2 '-' \d ** 2 '-' \d ** 2
        | \d ** 2 '-' \d ** 2 '-' \d ** 4
    }

    token time { \d ** 2 ':' \d ** 2 [ ':' \d ** 2 ]? }

    token pair { [<integer> | <float>] 'x' [<integer> | <float>] }
    token money { '$' [<integer> | <float>] }
    token tuple { <integer> '.' <integer> '.' [<integer> '.'?]+ }
    
    token logic {
        < true false on off yes no >
    }

    token binary-op { '->' | 'Z' }
}
