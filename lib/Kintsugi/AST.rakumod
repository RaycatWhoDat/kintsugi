class ASTNode {}

class AST::TOP is ASTNode {
    has ASTNode @.items = [];
}

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
