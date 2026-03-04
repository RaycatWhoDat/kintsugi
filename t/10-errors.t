use Test;
use Kintsugi::MockEvaluator;
use X::Kintsugi::Errors;

plan 4;

throws-like { run('foobar') }, X::Kintsugi::UndefinedWord, 'undefined word';
throws-like { run('[') }, X::Kintsugi::ParseError, 'parse error on unmatched bracket';
throws-like { run('my-fn: stub 2 my-fn 1 2') }, X::Kintsugi::NotImplemented, 'stub word raises NotImplemented';
throws-like { run('f: function [a b] [a + b] f 1') }, X::Kintsugi::ArityError, 'arity mismatch raises ArityError';
