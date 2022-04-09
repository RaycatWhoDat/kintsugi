use Test;
use lib '../lib';
use Kintsugi::Foundation::Grammar;
use Kintsugi::Actions;
use Kintsugi::AST;

plan 1;

subtest 'simple assignment' => {
    my $result = Kintsugi::Foundation::Grammar.parse(
        't/test-files/simple-assignment.ktgf'.IO.slurp,
        actions => Kintsugi::Actions
    );

    my @expected = [
        AST::WordAssignment,
        AST::IntegerValue,
        AST::WordAssignment,
        AST::FloatValue,
        AST::WordAssignment,
        AST::LogicValue,
        AST::WordAssignment,
        AST::StringValue,
    ];

    # ($result.made.items[.[0]] ~~ .[1]).&is(True) for @expected.kv;
    
    ($result.made.items[0] ~~ AST::WordAssignment).&is(True);
    ($result.made.items[1] ~~ AST::IntegerValue).&is(True);
    ($result.made.items[2] ~~ AST::WordAssignment).&is(True);
    ($result.made.items[3] ~~ AST::FloatValue).&is(True);
    ($result.made.items[4] ~~ AST::WordAssignment).&is(True);
    ($result.made.items[5] ~~ AST::LogicValue).&is(True);
    ($result.made.items[6] ~~ AST::WordAssignment).&is(True);
    ($result.made.items[7] ~~ AST::StringValue).&is(True);
    # ($result.made.items[8] ~~ AST::WordAssignment).&is(True);
    # ($result.made.items[9] ~~ AST::NoneValue).&is(True);
}
