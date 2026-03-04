use Kintsugi::AST;
use X::Kintsugi::Errors;

module Kintsugi::Dictionary::Core {
    our %words =
    'print' => { arity => 1, native => -> $, $a { say $a; $a } },
    
    '+' => { arity => 2, native => -> $, $a, $b { $a + $b } },
    '-' => { arity => 2, native => -> $, $a, $b { $a - $b } },
    '*' => { arity => 2, native => -> $, $a, $b { $a * $b } },
    '/' => { arity => 2, native => -> $, $a, $b { $a / $b } },
    '^' => { arity => 2, native => -> $, $a, $b { $a ^ $b } },
    '%' => { arity => 2, native => -> $, $a, $b { $a % $b } },
    
    '>' => { arity => 2, native => -> $, $a, $b { $a > $b } },
    '>=' => { arity => 2, native => -> $, $a, $b { $a >= $b } },
    '<>' => { arity => 2, native => -> $, $a, $b { $a !== $b } },
    '=' => { arity => 2, native => -> $, $a, $b { $a == $b } },
    '<=' => { arity => 2, native => -> $, $a, $b { $a <= $b } },
    "\x3C" => { arity => 2, native => -> $, $a, $b { $a < $b } },

    'stub'  => { arity => 1, native => -> $, $n { %( arity => $n, stub => True ) } },
    'compose' => {
        arity => 1,
        types => (AST::Block,),
        native => -> $eval, $block {
            my @new-items = $block.items.map: {
                $_ ~~ AST::Paren ?? $eval.run-items(.items) !! $_
            };
            AST::Block.new(items => @new-items, from => $block.from, to => $block.to);
        }
    },

    '->' => { arity => 2, native => -> $, $a, $b { !!! } },

    # --- Logic ---

    'not' => { arity => 1, native => -> $, $a { !$a } },
    'and' => { arity => 2, native => -> $, $a, $b { ?($a && $b) } },
    'or'  => { arity => 2, native => -> $, $a, $b { ?($a || $b) } },

    # --- Control flow ---

    'if' => {
        arity => 2,
        types => (Mu, AST::Block),
        native => -> $eval, $cond, $body {
            if $cond { $eval.run-items($body.items) }
            else { Nil }
        }
    },
    'either' => {
        arity => 3,
        types => (Mu, AST::Block, AST::Block),
        native => -> $eval, $cond, $true-body, $false-body {
            if $cond { $eval.run-items($true-body.items) }
            else { $eval.run-items($false-body.items) }
        }
    },
    'while' => {
        arity => 2,
        types => (AST::Block, AST::Block),
        native => -> $eval, $cond-block, $body {
            my $result = Nil;
            my $broken = False;
            loop {
                my $test = $eval.run-items($cond-block.items);
                last unless $eval.unwrap($test);
                {
                    $result = $eval.run-items($body.items);
                    CATCH { when X::Kintsugi::Break { $result = .value; $broken = True } }
                }
                last if $broken;
            }
            $result;
        }
    },
    'until' => {
        arity => 1,
        types => (AST::Block,),
        native => -> $eval, $body {
            my $result = Nil;
            my $broken = False;
            loop {
                {
                    $result = $eval.run-items($body.items);
                    CATCH { when X::Kintsugi::Break { $result = .value; $broken = True } }
                }
                last if $broken;
                last if $eval.unwrap($result);
            }
            $result;
        }
    },
    'loop' => {
        arity => 2,
        types => (Mu, AST::Block),
        native => -> $eval, $n, $body {
            my $result = Nil;
            my $broken = False;
            for ^$n {
                {
                    $result = $eval.run-items($body.items);
                    CATCH { when X::Kintsugi::Break { $result = .value; $broken = True } }
                }
                last if $broken;
            }
            $result;
        }
    },
    'break' => {
        arity => 0,
        native => -> $ { die X::Kintsugi::Break.new(value => Nil) }
    },

    'do' => {
        arity => 1,
        types => (AST::Block,),
        native => -> $eval, $block {
            $eval.run-items($block.items);
        }
    },

    # --- Block operations ---

    'length?' => {
        arity => 1,
        types => (AST::Block,),
        native => -> $eval, $block { $block.items.elems }
    },
    'empty?' => {
        arity => 1,
        types => (AST::Block,),
        native => -> $eval, $block { $block.items.elems == 0 }
    },
    'pick' => {
        arity => 2,
        types => (AST::Block,),
        native => -> $eval, $block, $n {
            (0 < $n <= $block.items.elems) ?? $block.items[$n - 1] !! Nil;
        }
    },
    'first' => {
        arity => 1,
        types => (AST::Block,),
        native => -> $eval, $block {
            die X::Kintsugi::TypeError.new(message => "first: block is empty")
                if $block.items.elems == 0;
            $block.items[0];
        }
    },
    'last' => {
        arity => 1,
        types => (AST::Block,),
        native => -> $eval, $block {
            die X::Kintsugi::TypeError.new(message => "last: block is empty")
                if $block.items.elems == 0;
            $block.items[*-1];
        }
    },
    'append' => {
        arity => 2,
        types => (AST::Block,),
        no-unwrap => True,
        native => -> $eval, $block, $value {
            $block.items.push($value);
            $block;
        }
    },
    'insert' => {
        arity => 3,
        types => (AST::Block,),
        no-unwrap => True,
        native => -> $eval, $block, $n, $value {
            my $idx = $eval.unwrap($n);
            die X::Kintsugi::TypeError.new(message => "insert: index {$idx} out of range")
                unless 0 < $idx <= $block.items.elems + 1;
            $block.items.splice($idx - 1, 0, $value);
            $block;
        }
    },
    'remove' => {
        arity => 2,
        types => (AST::Block,),
        native => -> $eval, $block, $n {
            die X::Kintsugi::TypeError.new(message => "remove: index {$n} out of range")
                unless 0 < $n <= $block.items.elems;
            $block.items.splice($n - 1, 1);
            $block;
        }
    },
    'copy' => {
        arity => 1,
        types => (AST::Block,),
        native => -> $eval, $block {
            AST::Block.new(items => [|$block.items], from => $block.from, to => $block.to);
        }
    },
    'reverse' => {
        arity => 1,
        types => (AST::Block,),
        native => -> $eval, $block {
            my @rev = $block.items.reverse;
            $block.items = @rev;
            $block;
        }
    },
    'select' => {
        arity => 2,
        types => (AST::Block,),
        no-unwrap => True,
        native => -> $eval, $block, $key {
            my @items = $block.items;
            my $key-val = $key.?value // $eval.unwrap($key);
            my $result = Nil;
            for ^@items.elems -> $i {
                my $item-val = @items[$i].?value // $eval.unwrap(@items[$i]);
                if $item-val eqv $key-val && $i + 1 < @items.elems {
                    $result = @items[$i + 1];
                    last;
                }
            }
            $result;
        }
    },

    # --- Iteration ---

    'each' => {
        arity => 3,
        types => (AST::Block, AST::Block, AST::Block),
        native => -> $eval, $words-block, $series, $body {
            my @words = $words-block.items.map(*.value);
            my $result = Nil;
            my $broken = False;
            my $i = 0;
            while $i < $series.items.elems {
                for @words -> $w {
                    last if $i >= $series.items.elems;
                    $eval.set($w, $series.items[$i++]);
                }
                {
                    $result = $eval.run-items($body.items);
                    CATCH { when X::Kintsugi::Break { $result = .value; $broken = True } }
                }
                last if $broken;
            }
            $result;
        }
    },
    'map' => {
        arity => 3,
        types => (AST::Block, AST::Block, AST::Block),
        native => -> $eval, $words-block, $series, $body {
            my @words = $words-block.items.map(*.value);
            my @results;
            my $broken = False;
            my $i = 0;
            while $i < $series.items.elems {
                for @words -> $w {
                    last if $i >= $series.items.elems;
                    $eval.set($w, $series.items[$i++]);
                }
                {
                    my $val = $eval.run-items($body.items);
                    @results.push($val);
                    CATCH { when X::Kintsugi::Break { $broken = True } }
                }
                last if $broken;
            }
            AST::Block.new(items => @results);
        }
    },
    'filter' => {
        arity => 3,
        types => (AST::Block, AST::Block, AST::Block),
        native => -> $eval, $words-block, $series, $body {
            my @words = $words-block.items.map(*.value);
            my @results;
            my $broken = False;
            my $i = 0;
            while $i < $series.items.elems {
                my @chunk;
                for @words -> $w {
                    last if $i >= $series.items.elems;
                    @chunk.push($series.items[$i]);
                    $eval.set($w, $series.items[$i++]);
                }
                {
                    my $test = $eval.run-items($body.items);
                    @results.append(@chunk) if $eval.unwrap($test);
                    CATCH { when X::Kintsugi::Break { $broken = True } }
                }
                last if $broken;
            }
            AST::Block.new(items => @results);
        }
    },
    'reduce' => {
        arity => 3,
        types => (AST::Block, AST::Block, AST::Block),
        native => -> $eval, $words-block, $series, $body {
            my @words = $words-block.items.map(*.value);
            die X::Kintsugi::ArityError.new(message => "reduce requires exactly 2 binding words")
                unless @words.elems == 2;
            die X::Kintsugi::ArityError.new(message => "reduce requires at least 1 item in series")
                unless $series.items.elems >= 1;
            my $acc = $series.items[0];
            my $i = 1;
            while $i < $series.items.elems {
                $eval.set(@words[0], $acc);
                $eval.set(@words[1], $series.items[$i++]);
                $acc = $eval.run-items($body.items);
            }
            $acc;
        }
    },

    # --- Type predicates ---

    'type?' => {
        arity => 1,
        no-unwrap => True,
        native => -> $eval, $a {
            given $a {
                when AST::Integer  { 'integer!' }
                when AST::Float    { 'float!' }
                when AST::Logic    { 'logic!' }
                when AST::Char     { 'char!' }
                when AST::String   { 'string!' }
                when AST::Block    { 'block!' }
                when AST::None     { 'none!' }
                when Associative   { 'function!' }
                default            { 'word!' }
            }
        }
    },
    'none?' => {
        arity => 1,
        no-unwrap => True,
        native => -> $, $a { $a ~~ AST::None }
    },
    'integer?' => {
        arity => 1,
        no-unwrap => True,
        native => -> $, $a { $a ~~ AST::Integer }
    },
    'float?' => {
        arity => 1,
        no-unwrap => True,
        native => -> $, $a { $a ~~ AST::Float }
    },
    'logic?' => {
        arity => 1,
        no-unwrap => True,
        native => -> $, $a { $a ~~ AST::Logic }
    },
    'char?' => {
        arity => 1,
        no-unwrap => True,
        native => -> $, $a { $a ~~ AST::Char }
    },
    'block?' => {
        arity => 1,
        no-unwrap => True,
        native => -> $, $a { $a ~~ AST::Block }
    },
    'function?' => {
        arity => 1,
        no-unwrap => True,
        native => -> $, $a { $a ~~ Associative && ($a<arity>:exists) }
    },
    'string?' => {
        arity => 1,
        no-unwrap => True,
        native => -> $, $a { $a ~~ AST::String }
    },

    # --- Error handling ---

    'try' => {
        arity => 1,
        types => (AST::Block,),
        native => -> $eval, $block {
            my $result;
            {
                $result = $eval.run-items($block.items);
                CATCH { when X::Kintsugi { $result = Nil } }
            }
            $result;
        }
    },

    # --- Utilities ---

    'return' => {
        arity => 1,
        no-unwrap => True,
        native => -> $, $val { die X::Kintsugi::Return.new(value => $val) }
    },
    'apply' => {
        arity => 2,
        no-unwrap => True,
        native => -> $eval, $fn, $args-block {
            die X::Kintsugi::TypeError.new(message => "apply: first arg must be a function")
                unless $fn ~~ Associative && ($fn<arity>:exists);
            die X::Kintsugi::TypeError.new(message => "apply: second arg must be a block")
                unless $args-block ~~ AST::Block;
            my @args;
            my $pos = 0;
            for ^$fn<arity> {
                my ($val, $new-pos) = $eval.step($args-block.items, $pos);
                @args.push($val);
                $pos = $new-pos;
            }
            if $fn<native>:exists {
                my @call-args = $fn<no-unwrap> ?? @args !! @args.map({ $eval.unwrap($_) });
                $eval.wrap-value($fn<native>($eval, |@call-args));
            } else {
                $eval.push-scope();
                for $fn<params>.kv -> $i, $name {
                    $eval.set($name, @args[$i]);
                }
                my $result;
                {
                    $result = $eval.run-items($fn<body>.items);
                    CATCH { when X::Kintsugi::Return { $result = .value } }
                }
                $eval.pop-scope();
                $result;
            }
        }
    },
    'min' => { arity => 2, native => -> $, $a, $b { $a min $b } },
    'max' => { arity => 2, native => -> $, $a, $b { $a max $b } },
    'abs' => { arity => 1, native => -> $, $a { $a.abs } },
    'negate' => { arity => 1, native => -> $, $a { -$a } },
    'odd?' => { arity => 1, native => -> $, $a { ?($a % 2 != 0) } },
    'even?' => { arity => 1, native => -> $, $a { ?($a % 2 == 0) } },
    'probe' => {
        arity => 1,
        no-unwrap => True,
        native => -> $eval, $a { say $eval.form-item($a); $a }
    },
    'quit' => {
        arity => 0,
        native => -> $ { exit 0 }
    },
}

module Kintsugi::Dictionary::Systems {
    our %words =
    'form' => {
        arity => 1,
        no-unwrap => True,
        native => -> $eval, $a {
            $eval.form-item($a);
        }
    },
    'join' => {
        arity => 2,
        no-unwrap => True,
        native => -> $eval, $a, $b {
            given $a {
                when AST::Block {
                    my @new-items = |$a.items;
                    if $b ~~ AST::Block { @new-items.append($b.items) }
                    else { @new-items.push($b) }
                    AST::Block.new(items => @new-items, from => $a.from, to => $a.to);
                }
                default {
                    my $bs = $b ~~ AST::Block
                        ?? $b.items.map({ $eval.form-item($_) }).join
                        !! $eval.form-item($b);
                    $eval.form-item($a) ~ $bs;
                }
            }
        }
    },
    'reform' => {
        arity => 1,
        types => (AST::Block,),
        native => -> $eval, $block {
            my @results;
            my $pos = 0;
            while $pos < $block.items.elems {
                my ($val, $new-pos) = $eval.step($block.items, $pos);
                @results.push($eval.form-item($val));
                $pos = $new-pos;
            }
            @results.join(' ');
        }
    },
    'rejoin' => {
        arity => 1,
        types => (AST::Block,),
        native => -> $eval, $block {
            my @results;
            my $pos = 0;
            while $pos < $block.items.elems {
                my ($val, $new-pos) = $eval.step($block.items, $pos);
                @results.push($eval.form-item($val));
                $pos = $new-pos;
            }
            @results.join;
        }
    },
}

module Kintsugi::Dictionary::Full {
    our %words;
}
