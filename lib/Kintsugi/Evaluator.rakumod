use Kintsugi::AST;
use Kintsugi::Dictionary;
use X::Kintsugi::Errors;

class Kintsugi::Evaluator {
    has @.scopes;
    has %.dictionary;
    has Str $.source;
    has Str $.tier = 'Core';

    submethod TWEAK() {
        @!scopes.push(%());
        %!dictionary = |%!dictionary, |%Kintsugi::Dictionary::Core::words;
        %!dictionary = |%!dictionary, |%Kintsugi::Dictionary::Systems::words if $!tier eq 'Kintsugi/Systems' | 'Kintsugi' | 'Kintsugi/Full';
        %!dictionary = |%!dictionary, |%Kintsugi::Dictionary::Full::words    if $!tier eq 'Kintsugi/Full';
    }

    method loc($node) {
        return "" unless $!source && $node.?from.defined;
        my $line = $!source.substr(0, $node.from).split("\n").elems;
        " at line $line";
    }

    # --- Scope ---

    method push-scope() { @!scopes.push({}) }
    method pop-scope()  { @!scopes.pop }

    method set(Str $name, $value) {
        @!scopes[*-1]{$name} = $value;
    }

    method get(Str $name, $node?) {
        for @!scopes.reverse -> %scope {
            return %scope{$name} if %scope{$name}:exists;
        }
        return %!dictionary{$name} if %!dictionary{$name}:exists;
        die X::Kintsugi::UndefinedWord.new(message => "Undefined word: {$name}{self.loc($node)}");
    }

    # --- Path access ---

    method unwrap($node) {
        given $node {
            when AST::Integer { .value }
            when AST::Float   { .value }
            when AST::String  { .value }
            when AST::Logic   { .value }
            when AST::Char    { .value }
            when AST::None    { Nil }
            default           { $node }
        }
    }

    method form-item($item) {
        given $item {
            when AST::Paren { .items.map({ self.form-item($_) }).join(' ') }
            when AST::Block { .items.map({ self.form-item($_) }).join(' ') }
            when AST::None  { 'none' }
            default { $item.?value.defined ?? $item.value.Str !! self.unwrap($item).Str }
        }
    }

    method wrap-value($val) {
        given $val {
            when Bool { AST::Logic.new(value => $val) }
            when Int  { AST::Integer.new(value => $val) }
            when Rat  { AST::Float.new(value => $val) }
            when Str  { AST::String.new(value => $val) }
            when !.defined { AST::None.new }
            default   { $val }
        }
    }

    method walk-path(Str $head, @segments, $node) {
        my $val = self.get($head, $node);
        for @segments -> $seg {
            if $seg ~~ Int {
                die X::Kintsugi::TypeError.new(message => "Cannot index into {$val ~~ Span ?? $val.type-name !! $val.^name} with /{$seg}{self.loc($node)}") unless $val ~~ AST::Block;
                die X::Kintsugi::TypeError.new(message => "Index {$seg} out of range{self.loc($node)}") unless 0 < $seg <= $val.items.elems;
                $val = $val.items[$seg - 1];
            } else {
                die X::Kintsugi::TypeError.new(message => "Cannot access /{$seg} on {$val ~~ Span ?? $val.type-name !! $val.^name}{self.loc($node)}") unless $val ~~ Associative;
                $val = $val{$seg};
            }
        }
        $val;
    }

    # --- Walk ---

    method run(AST::TOP $top) {
        self.run-items($top.items);
    }

    method run-items(@items) {
        my $result;
        my $pos = 0;
        while $pos < @items.elems {
            ($result, $pos) = self.step(@items, $pos);
        }
        $result;
    }

    # Evaluate one expression starting at $pos.
    # Returns (value, next-position).
    method step(@items, Int $pos is copy --> List) {
        my $node = @items[$pos];
        my $val;

        given $node {
            when AST::SetWord {
                my $name = .value;
                $pos++;
                ($val, $pos) = self.step(@items, $pos);
                self.set($name, $val);
            }

            when AST::Path {
                $val = self.walk-path(.head, .segments, $node);
                $pos++;
            }

            when AST::SetPath {
                $pos++;
                my $rhs;
                ($rhs, $pos) = self.step(@items, $pos);
                my @segs = .segments;
                my $last = @segs.pop;
                my $target = @segs.elems > 0
                    ?? self.walk-path(.head, @segs, $node)
                    !! self.get(.head, $node);
                if $last ~~ Int {
                    die X::Kintsugi::TypeError.new(message => "Cannot index into {$target.^name} with /{$last}{self.loc($node)}")
                        unless $target ~~ AST::Block;
                    die X::Kintsugi::TypeError.new(message => "Index {$last} out of range{self.loc($node)}")
                        unless 0 < $last <= $target.items.elems;
                    $target.items[$last - 1] = $rhs;
                } else {
                    die X::Kintsugi::TypeError.new(message => "Cannot access /{$last} on {$target.^name}{self.loc($node)}")
                        unless $target ~~ Associative;
                    $target{$last} = $rhs;
                }
                $val = $rhs;
            }

            when AST::GetPath {
                $val = self.walk-path(.head, .segments, $node);
                $pos++;
            }

            when AST::Word {
                my $entry = self.get(.value, $node);
                if $entry ~~ Associative && ($entry<arity>:exists) {
                    my $word-name = .value;
                    $pos++;
                    my $remaining = @items.elems - $pos;
                    if $remaining < $entry<arity> {
                        die X::Kintsugi::ArityError.new(message => "{$word-name}: Expected {$entry<arity>} arguments, got {$remaining}{self.loc($node)}");
                    }
                    my @args;
                    for ^$entry<arity> {
                        my $arg;
                        ($arg, $pos) = self.step(@items, $pos);
                        @args.push($arg);
                    }
                    if $entry<types>:exists {
                        for $entry<types>.kv -> $i, $type {
                            unless @args[$i] ~~ $type {
                                my $got = @args[$i] ~~ Span ?? @args[$i].type-name !! @args[$i].^name;
                                my $expected = $type ~~ Junction
                                    ?? $type.eigenstates.map(*.type-name).join(' or ')
                                    !! $type.type-name;
                                die X::Kintsugi::TypeError.new(
                                    message => "{$word-name} expects a {$expected}, got {$got}{self.loc($node)}"
                                );
                            }
                        }
                    }
                    if $entry<stub>:exists {
                        die X::Kintsugi::NotImplemented.new(message => "Not yet implemented: {$word-name}{self.loc($node)}");
                    } elsif $entry<native>:exists {
                        my @call-args = $entry<no-unwrap> ?? @args !! @args.map({ self.unwrap($_) });
                        $val = self.wrap-value($entry<native>(self, |@call-args));
                    } else {
                        self.push-scope();
                        for $entry<params>.kv -> $i, $name {
                            self.set($name, @args[$i]);
                        }
                        {
                            $val = self.run-items($entry<body>.items);
                            CATCH { when X::Kintsugi::Return { $val = .value } }
                        }
                        self.pop-scope();
                    }
                } else {
                    $val = $entry;
                    $pos++;
                }
            }

            when AST::GetWord {
                # returns the value of the word without calling it
                $val = self.get(.value, $node);
                $pos++;
            }

            when AST::LitWord {
                # returns the word name as a value
                $val = .value;
                $pos++;
            }

            when AST::Function {
                for .params.items -> $p {
                    die X::Kintsugi::TypeError.new(message => "Function parameter must be a word, got {$p.^name}{self.loc($p)}")
                        unless $p ~~ AST::Word;
                }
                my @param-nodes = .params.items;
                my @params = @param-nodes.map(*.value);
                my $seen = SetHash.new;
                for @param-nodes -> $p {
                    die X::Kintsugi::DuplicateParam.new(message => "Duplicate parameter: {$p.value}{self.loc($p)}") if $seen{$p.value};
                    $seen.set($p.value);
                }
                $val = %( arity => @params.elems, params => @params, body => .body );
                $pos++;
            }
            when AST::Paren   { $val = self.run-items(.items); $pos++ }

            default { $val = $node; $pos++ }
        }

        # Infix lookahead: if next item is an operator, consume it
        while $pos < @items.elems && @items[$pos] ~~ AST::Operator {
            my $op-name = @items[$pos].value;
            $pos++;
            my $right;
            ($right, $pos) = self.step(@items, $pos);
            $val = self.wrap-value(%!dictionary{$op-name}<native>(self, self.unwrap($val), self.unwrap($right)));
        }

        ($val, $pos);
    }
}
