import { Predicate, Token, TOKEN_TYPES } from '@types';

const LOGIC_WORDS = ['true', 'false'];
const OPERATOR_CHARACTERS = '+-*=<>/%|';
const ESCAPE_MAP = { n: '\n', t: '\t' };

export function* createLexerFromString(input: string): Generator<Token, null, unknown> {
  let currentPos = 0;
  let currentLine = 1;

  // ================ 
  
  const peek = () => input[currentPos];
  const peekNext = () => input[currentPos + 1];
  const advance = () => { const ch = input[currentPos++]; if (ch === '\n') currentLine++; return ch; };
  const isAtEnd = () => currentPos >= input.length;
  const isWhitespace = (char: string) => typeof char === 'string' && /\s/.test(char);
  const isDigit = (char: string) => typeof char === 'string' && /\d/.test(char);
  const isAlpha = (char: string) => typeof char === 'string' && /[a-z]/i.test(char);
  const isWordChar = (char: string) => typeof char === 'string' && /[a-z0-9_?!~-]/i.test(char);
  const isFileChar = (char: string) => typeof char === 'string' && /[a-z0-9._\/\\-]/i.test(char);
  const isUrlChar = (char: string) => typeof char === 'string' && !isWhitespace(char) && !'[]()'.includes(char);
  const tok = (type: Token['type'], value: string, line?: number): Token => ({ type, value, line: line ?? currentLine });
  
  const consumeWhile = (predicate: Predicate): string => {
    let value = '';
    while (!isAtEnd() && predicate(peek())) value += advance();
    return value;
  };
  
  const consumeUntil = (openingCharacter: string, closingCharacter?: string): string => {
    if (!closingCharacter) closingCharacter = openingCharacter;

    let value = '';
    advance();
    while (!isAtEnd() && peek() !== closingCharacter) {
      if (peek() === '\\') {
        advance();
        const ch = advance();
        value += ESCAPE_MAP[ch] ?? ch;
        continue;
      }
      
      value += advance();
    }
    advance();
    return value;
  };

  const consumeAllComponents = (delimiter: string, predicate: Predicate, numberOfIterations?: number): string => {
    let value = '';
    while (peek() === delimiter && (numberOfIterations === undefined || numberOfIterations-- > 0)) {
      value += advance();
      value += consumeWhile(predicate);
    }
    return value;
  }

  const consumeWordOrPath = (prefix?: "'" | ':', startLine?: number): Token => {
    startLine = startLine ?? currentLine;
    let value = consumeWhile(isWordChar);

    // URL: scheme://rest
    if (peek() === ':' && peekNext() === '/') {
      // Check for :// — need to peek two ahead
      const savedPos = currentPos;
      advance(); // :
      if (peek() === '/' && peekNext() === '/') {
        value += ':';
        value += advance(); // first /
        value += advance(); // second /
        value += consumeWhile(isUrlChar);
        return tok(TOKEN_TYPES.URL, value, startLine);
      }
      // Not a URL — backtrack
      currentPos = savedPos;
    }

    // Email: word@domain or word.word@domain
    if (peek() === '@' || (peek() === '.' && !isDigit(peekNext()))) {
      // Speculatively consume dot-separated segments looking for @
      const savedPos = currentPos;
      let extra = '';
      while (peek() === '.' && isWordChar(peekNext())) {
        extra += advance(); // .
        extra += consumeWhile(isWordChar);
      }
      if (peek() === '@' && isAlpha(peekNext())) {
        value += extra;
        value += advance(); // @
        const isDomainChar = (char: string) => typeof char === 'string' && /[a-z0-9._-]/i.test(char);
        value += consumeWhile(isDomainChar);
        return tok(TOKEN_TYPES.EMAIL, value, startLine);
      }
      // Not an email — backtrack
      currentPos = savedPos;
    }

    let isWordOrPath = peek() === '/' ? 'PATH' : 'WORD';

    // If this is a path, consume all path components...
    if (isWordOrPath === 'PATH') value += consumeAllComponents('/', isWordChar);

    if (peek() === ':') {
      advance();
      return tok(TOKEN_TYPES[`SET_${isWordOrPath}`] as any, value, startLine);
    }

    let type = TOKEN_TYPES[isWordOrPath];
    if (prefix === ':') type = TOKEN_TYPES[`GET_${isWordOrPath}`];
    if (prefix === "'") type = TOKEN_TYPES[`LIT_${isWordOrPath}`];

    // Logic and none literals (only for plain words, not get/lit/paths)
    if (!prefix && isWordOrPath === 'WORD') {
      if (LOGIC_WORDS.includes(value)) type = TOKEN_TYPES.LOGIC;
      if (value === 'none') type = TOKEN_TYPES.NONE;
    }

    return tok(type, value, startLine);
  }
  
  // ================ 

  // While we're not at the end...
  while (!isAtEnd()) {
    const startLine = currentLine;
    const currentChar = peek();

    // Whitespace 
    if (isWhitespace(currentChar)) {
      advance();
      continue;
    }

    // Comments
    if (currentChar === ';') {
      while (!isAtEnd() && peek() !== '\n') advance();
      continue;
    }

    // Blocks
    if (currentChar === '[' || currentChar === ']') {
      advance();
      yield tok(TOKEN_TYPES.BLOCK, currentChar, startLine);
      continue;
    }

    // Parens
    if (currentChar === '(' || currentChar === ')') {
      advance();
      yield tok(TOKEN_TYPES.PAREN, currentChar, startLine);
      continue;
    }

    // Meta-word (@enter, @exit, @add, etc.)
    if (currentChar === '@') {
      advance();
      const { value } = consumeWordOrPath(undefined, startLine);
      yield tok(TOKEN_TYPES.META_WORD, value, startLine);
      continue;
    }

    if (currentChar === '#') {
      advance();

      const token: Token = { type: TOKEN_TYPES.STUB, value: '', line: startLine };

      if (peek() === '[') {
        // #[expr] — inline preprocess
        token.type = TOKEN_TYPES.DIRECTIVE;
        token.value = 'inline';
      }

      if (isAlpha(peek())) {
        token.type = TOKEN_TYPES.DIRECTIVE;
        token.value = consumeWhile(isAlpha);
      }

      yield token;
      continue;
    }

    // Words and paths
    if (currentChar === "'" || currentChar === ':') {
      advance(); // skip prefix
      yield consumeWordOrPath(currentChar, startLine);
      continue;
    }

    if (isAlpha(currentChar) || currentChar === '_') {
      yield consumeWordOrPath(undefined, startLine);
      continue;
    }

    // Strings
    if (currentChar === '"' || currentChar === '{') {
      const value = currentChar === '{' ? consumeUntil('}') : consumeUntil('"');
      yield tok(TOKEN_TYPES.STRING, value, startLine);
      continue;
    }

    // Numbers, floats, tuples...
    if (isDigit(currentChar) || (currentChar === '-' && isDigit(peekNext()))) {
      let value = '';
      if (currentChar === '-') value += advance();
      value += consumeWhile(isDigit);

      // Time: 14:30 or 14:30:00
      if (peek() === ':' && isDigit(peekNext())) {
        value += consumeAllComponents(':', isDigit, 2);
        yield tok(TOKEN_TYPES.TIME, value, startLine);
        continue;
      }

      if (peek() === 'x' && isDigit(peekNext())) {
        value += consumeAllComponents('x', isDigit, 1);
        yield tok(TOKEN_TYPES.PAIR, value, startLine);
        continue;
      }

      if (peek() === '-' && isDigit(peekNext())) {
        value += consumeAllComponents('-', isDigit, 2);
        yield tok(TOKEN_TYPES.DATE, value, startLine);
        continue;
      }
 
      const components = consumeAllComponents('.', isDigit);
      if (!components) {
        yield tok(TOKEN_TYPES.INTEGER, value, startLine);
      } else {
        value += components;
        const dotCount = (components.match(/\./g) || []).length;
        yield tok(dotCount === 1 ? TOKEN_TYPES.FLOAT : TOKEN_TYPES.TUPLE, value, startLine);
      }
      continue;
    }

    // file references: %filename.ktg
    if (currentChar === '%' && (isFileChar(peekNext()) || peekNext() === '"')) {
      advance();

      let value = peek() === '"'
        ? consumeUntil('"')
        : consumeWhile(isFileChar);
      
      yield tok(TOKEN_TYPES.FILE, value, startLine);
      continue;
    }

    // Money: $19.99
    if (currentChar === '$' && isDigit(peekNext())) {
      advance(); // skip $
      let value = consumeWhile(isDigit);
      if (peek() === '.' && isDigit(peekNext())) {
        value += advance(); // the dot
        value += consumeWhile(isDigit);
      }
      yield tok(TOKEN_TYPES.MONEY, value, startLine);
      continue;
    }

    if (OPERATOR_CHARACTERS.includes(currentChar)) {
      let value = advance();

      if (value === '<' && peek() === '=') value += advance();
      if (value === '>' && peek() === '=') value += advance();
      if (value === '<' && peek() === '>') value += advance();
      
      yield tok(TOKEN_TYPES.OPERATOR, value, startLine);
      continue;
    }
    
    // Fallback — emit stub for unrecognized characters
    yield tok(TOKEN_TYPES.STUB, source[pos], startLine);
    advance();
  }
  return null;
}
