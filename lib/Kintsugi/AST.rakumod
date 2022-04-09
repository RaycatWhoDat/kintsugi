class ASTNode {}

class AST::BlockValue is ASTNode {
    has ASTNode @.items = [];
}

class AST::TOP is AST::BlockValue {}

class AST::WordAssignment is ASTNode {
    has Str $.name;
    has ASTNode $.value;
}

class AST::NoneValue is ASTNode {}

class AST::IntegerValue is ASTNode {
    has Int $.value;
}

class AST::FloatValue is ASTNode {
    has Rat $.value;
}

class AST::LogicValue is ASTNode {
    has Bool $.value;
}

class AST::StringValue is ASTNode {
    has Str $.value;
}

class AST::FileValue is ASTNode {
    has Str $.name;
    has IO $.value is rw;
}

class AST::FunctionValue is ASTNode {
    has @.params = [];
    has ASTNode @.body = [];
}
