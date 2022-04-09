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
        AST::WordAssignment,
        AST::NoneValue,
        AST::WordAssignment,
        AST::FileValue,
        AST::WordAssignment,
        AST::BlockValue,
        AST::WordAssignment,
        AST::FunctionValue,
        AST::WordAssignment,
        AST::FunctionValue
    ];

    for $result.made.items.kv -> $index, $node {
        my $result = $node ~~ @expected[$index];
        say $node unless $result;
        $result.&is(True);
    }
}
