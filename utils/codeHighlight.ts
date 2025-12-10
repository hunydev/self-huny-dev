/**
 * Simple syntax highlighter for code blocks
 * Works without language specification by detecting common patterns
 */

// Token types with corresponding colors
const TOKEN_STYLES: Record<string, string> = {
  string: 'text-amber-300',      // 문자열: 노란색
  number: 'text-purple-400',     // 숫자: 보라색
  keyword: 'text-pink-400',      // 키워드: 분홍색
  comment: 'text-slate-500',     // 주석: 회색
  function: 'text-blue-400',     // 함수: 파란색
  operator: 'text-cyan-300',     // 연산자: 청록색
  bracket: 'text-yellow-200',    // 괄호: 연한 노랑
  property: 'text-green-400',    // 속성: 초록색
  tag: 'text-red-400',           // HTML 태그: 빨간색
  attribute: 'text-orange-400',  // 속성: 주황색
  punctuation: 'text-slate-400', // 구두점: 회색
  default: 'text-slate-100',     // 기본: 밝은 회색
};

// Common keywords across multiple languages
const KEYWORDS = new Set([
  // JavaScript/TypeScript
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw',
  'class', 'extends', 'new', 'this', 'super', 'static', 'async', 'await',
  'import', 'export', 'from', 'default', 'typeof', 'instanceof', 'in', 'of',
  'true', 'false', 'null', 'undefined', 'void', 'delete',
  // Python
  'def', 'lambda', 'pass', 'with', 'as', 'yield', 'global', 'nonlocal',
  'assert', 'raise', 'except', 'True', 'False', 'None', 'and', 'or', 'not', 'is',
  'elif', 'print', 'self', 'cls',
  // Java/C#/C++
  'public', 'private', 'protected', 'abstract', 'interface', 'implements',
  'final', 'override', 'virtual', 'struct', 'enum', 'namespace', 'using',
  'int', 'float', 'double', 'bool', 'boolean', 'string', 'char', 'long', 'short',
  // Go
  'package', 'func', 'go', 'defer', 'select', 'chan', 'map', 'range', 'type',
  // Rust
  'fn', 'let', 'mut', 'impl', 'trait', 'pub', 'mod', 'use', 'crate', 'match', 'loop',
  // SQL
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP',
  'TABLE', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR',
  'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AS', 'INTO', 'VALUES',
  // Shell
  'echo', 'exit', 'cd', 'ls', 'grep', 'sed', 'awk', 'cat', 'rm', 'cp', 'mv', 'mkdir',
]);

interface Token {
  type: keyof typeof TOKEN_STYLES;
  value: string;
}

// Escape HTML entities
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Tokenize code into syntax-aware segments
const tokenize = (code: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  
  while (i < code.length) {
    let matched = false;
    
    // Multi-line comment /* */
    if (code.slice(i, i + 2) === '/*') {
      const end = code.indexOf('*/', i + 2);
      const value = end === -1 ? code.slice(i) : code.slice(i, end + 2);
      tokens.push({ type: 'comment', value });
      i += value.length;
      matched = true;
    }
    // Single-line comment // or #
    else if (code.slice(i, i + 2) === '//' || (code[i] === '#' && (i === 0 || /[\s\n]/.test(code[i-1])))) {
      const newline = code.indexOf('\n', i);
      const value = newline === -1 ? code.slice(i) : code.slice(i, newline);
      tokens.push({ type: 'comment', value });
      i += value.length;
      matched = true;
    }
    // HTML comment
    else if (code.slice(i, i + 4) === '<!--') {
      const end = code.indexOf('-->', i + 4);
      const value = end === -1 ? code.slice(i) : code.slice(i, end + 3);
      tokens.push({ type: 'comment', value });
      i += value.length;
      matched = true;
    }
    // Double-quoted string
    else if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length && !(code[j] === '"' && code[j-1] !== '\\')) j++;
      const value = code.slice(i, j + 1);
      tokens.push({ type: 'string', value });
      i = j + 1;
      matched = true;
    }
    // Single-quoted string
    else if (code[i] === "'") {
      let j = i + 1;
      while (j < code.length && !(code[j] === "'" && code[j-1] !== '\\')) j++;
      const value = code.slice(i, j + 1);
      tokens.push({ type: 'string', value });
      i = j + 1;
      matched = true;
    }
    // Template literal
    else if (code[i] === '`') {
      let j = i + 1;
      while (j < code.length && !(code[j] === '`' && code[j-1] !== '\\')) j++;
      const value = code.slice(i, j + 1);
      tokens.push({ type: 'string', value });
      i = j + 1;
      matched = true;
    }
    // HTML/XML tags
    else if (code[i] === '<' && /[a-zA-Z\/!]/.test(code[i + 1] || '')) {
      const tagEnd = code.indexOf('>', i);
      if (tagEnd !== -1) {
        const tagContent = code.slice(i, tagEnd + 1);
        // Parse tag content for better highlighting
        const tagMatch = tagContent.match(/^(<\/?)([\w-]+)(.*?)(\/?>)$/s);
        if (tagMatch) {
          tokens.push({ type: 'punctuation', value: tagMatch[1] });
          tokens.push({ type: 'tag', value: tagMatch[2] });
          // Parse attributes
          const attrPart = tagMatch[3];
          if (attrPart) {
            const attrTokens = parseAttributes(attrPart);
            tokens.push(...attrTokens);
          }
          tokens.push({ type: 'punctuation', value: tagMatch[4] });
          i = tagEnd + 1;
          matched = true;
        }
      }
    }
    // Numbers (including decimals, hex, binary, octal)
    else if (/[0-9]/.test(code[i]) || (code[i] === '.' && /[0-9]/.test(code[i + 1] || ''))) {
      let j = i;
      // Hex, binary, octal
      if (code[i] === '0' && /[xXbBoO]/.test(code[i + 1] || '')) {
        j += 2;
        while (j < code.length && /[0-9a-fA-F_]/.test(code[j])) j++;
      } else {
        while (j < code.length && /[0-9._eE+-]/.test(code[j])) j++;
      }
      tokens.push({ type: 'number', value: code.slice(i, j) });
      i = j;
      matched = true;
    }
    // Words (keywords, identifiers, functions)
    else if (/[a-zA-Z_$]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j])) j++;
      const word = code.slice(i, j);
      
      // Check if it's followed by ( for function detection
      const nextChar = code[j];
      
      if (KEYWORDS.has(word) || KEYWORDS.has(word.toUpperCase())) {
        tokens.push({ type: 'keyword', value: word });
      } else if (nextChar === '(') {
        tokens.push({ type: 'function', value: word });
      } else if (code[i - 1] === '.') {
        tokens.push({ type: 'property', value: word });
      } else {
        tokens.push({ type: 'default', value: word });
      }
      i = j;
      matched = true;
    }
    // Operators
    else if (/[+\-*/%=<>!&|^~?:]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[+\-*/%=<>!&|^~?:]/.test(code[j])) j++;
      tokens.push({ type: 'operator', value: code.slice(i, j) });
      i = j;
      matched = true;
    }
    // Brackets
    else if (/[()[\]{}]/.test(code[i])) {
      tokens.push({ type: 'bracket', value: code[i] });
      i++;
      matched = true;
    }
    // Punctuation
    else if (/[,;.]/.test(code[i])) {
      tokens.push({ type: 'punctuation', value: code[i] });
      i++;
      matched = true;
    }
    
    // Default: just pass through
    if (!matched) {
      tokens.push({ type: 'default', value: code[i] });
      i++;
    }
  }
  
  return tokens;
};

// Parse HTML/XML attributes
const parseAttributes = (attrStr: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  
  while (i < attrStr.length) {
    // Whitespace
    if (/\s/.test(attrStr[i])) {
      let j = i;
      while (j < attrStr.length && /\s/.test(attrStr[j])) j++;
      tokens.push({ type: 'default', value: attrStr.slice(i, j) });
      i = j;
    }
    // Attribute name
    else if (/[a-zA-Z_:@]/.test(attrStr[i])) {
      let j = i;
      while (j < attrStr.length && /[a-zA-Z0-9_:\-@]/.test(attrStr[j])) j++;
      tokens.push({ type: 'attribute', value: attrStr.slice(i, j) });
      i = j;
    }
    // Equals
    else if (attrStr[i] === '=') {
      tokens.push({ type: 'operator', value: '=' });
      i++;
    }
    // Quoted value
    else if (attrStr[i] === '"' || attrStr[i] === "'") {
      const quote = attrStr[i];
      let j = i + 1;
      while (j < attrStr.length && attrStr[j] !== quote) j++;
      tokens.push({ type: 'string', value: attrStr.slice(i, j + 1) });
      i = j + 1;
    }
    else {
      tokens.push({ type: 'default', value: attrStr[i] });
      i++;
    }
  }
  
  return tokens;
};

// Convert tokens to highlighted HTML
const tokensToHtml = (tokens: Token[]): string => {
  return tokens.map(token => {
    const escaped = escapeHtml(token.value);
    const style = TOKEN_STYLES[token.type] || TOKEN_STYLES.default;
    return `<span class="${style}">${escaped}</span>`;
  }).join('');
};

/**
 * Highlight code and return HTML string
 */
export const highlightCode = (code: string): string => {
  const tokens = tokenize(code);
  return tokensToHtml(tokens);
};

/**
 * React component for highlighted code
 */
export const createHighlightedCodeHtml = (code: string): { __html: string } => {
  return { __html: highlightCode(code) };
};
