// HTML Sanitizer - 허용된 태그와 속성만 유지하여 XSS 공격 방지

// 허용된 태그 목록
const ALLOWED_TAGS = new Set([
  'p', 'br', 'div', 'span',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a',
  'pre', 'code',
  'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'sub', 'sup',
]);

// 허용된 속성 목록 (태그별)
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  '*': new Set(['style', 'class']),
  'a': new Set(['href', 'target', 'rel']),
  'td': new Set(['colspan', 'rowspan']),
  'th': new Set(['colspan', 'rowspan']),
};

// 허용된 CSS 속성 목록
const ALLOWED_CSS_PROPERTIES = new Set([
  'color',
  'background-color',
  'background',
  'font-weight',
  'font-style',
  'font-size',
  'text-decoration',
  'text-align',
  'font-family',
]);

// CSS 속성 값 sanitize
const sanitizeCssValue = (_property: string, value: string): string | null => {
  // url() 등 위험한 값 차단
  if (/url\s*\(/i.test(value) || /expression\s*\(/i.test(value) || /javascript:/i.test(value)) {
    return null;
  }
  return value;
};

// style 속성 sanitize
const sanitizeStyle = (style: string): string => {
  const sanitized: string[] = [];
  
  // CSS 파싱
  const declarations = style.split(';');
  for (const declaration of declarations) {
    const colonIndex = declaration.indexOf(':');
    if (colonIndex === -1) continue;
    
    const property = declaration.substring(0, colonIndex).trim().toLowerCase();
    const value = declaration.substring(colonIndex + 1).trim();
    
    if (ALLOWED_CSS_PROPERTIES.has(property)) {
      const sanitizedValue = sanitizeCssValue(property, value);
      if (sanitizedValue) {
        sanitized.push(`${property}: ${sanitizedValue}`);
      }
    }
  }
  
  return sanitized.join('; ');
};

// HTML sanitize
export const sanitizeHtml = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const sanitizeNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode();
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }
    
    const element = node as Element;
    const tagName = element.tagName.toLowerCase();
    
    // 허용되지 않은 태그는 자식만 반환
    if (!ALLOWED_TAGS.has(tagName)) {
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(element.childNodes)) {
        const sanitizedChild = sanitizeNode(child);
        if (sanitizedChild) {
          fragment.appendChild(sanitizedChild);
        }
      }
      return fragment;
    }
    
    // 새 요소 생성
    const newElement = document.createElement(tagName);
    
    // 허용된 속성만 복사
    const globalAttrs = ALLOWED_ATTRIBUTES['*'] || new Set();
    const tagAttrs = ALLOWED_ATTRIBUTES[tagName] || new Set();
    
    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase();
      
      if (globalAttrs.has(attrName) || tagAttrs.has(attrName)) {
        let attrValue = attr.value;
        
        // style 속성 sanitize
        if (attrName === 'style') {
          attrValue = sanitizeStyle(attrValue);
          if (!attrValue) continue;
        }
        
        // href 속성 검증
        if (attrName === 'href') {
          if (/^javascript:/i.test(attrValue)) continue;
          // 외부 링크에 보안 속성 추가
          newElement.setAttribute('target', '_blank');
          newElement.setAttribute('rel', 'noopener noreferrer');
        }
        
        newElement.setAttribute(attrName, attrValue);
      }
    }
    
    // 자식 요소 sanitize
    for (const child of Array.from(element.childNodes)) {
      const sanitizedChild = sanitizeNode(child);
      if (sanitizedChild) {
        newElement.appendChild(sanitizedChild);
      }
    }
    
    return newElement;
  };
  
  const fragment = document.createDocumentFragment();
  for (const child of Array.from(doc.body.childNodes)) {
    const sanitizedChild = sanitizeNode(child);
    if (sanitizedChild) {
      fragment.appendChild(sanitizedChild);
    }
  }
  
  // 결과를 HTML 문자열로 변환
  const div = document.createElement('div');
  div.appendChild(fragment);
  return div.innerHTML;
};

// HTML이 서식을 포함하는지 확인
export const hasRichFormatting = (html: string): boolean => {
  if (!html) return false;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // 서식 태그 확인
  const formattingTags = ['b', 'strong', 'i', 'em', 'u', 's', 'del', 'strike', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'code', 'blockquote', 'table', 'a'];
  for (const tag of formattingTags) {
    if (doc.body.querySelector(tag)) return true;
  }
  
  // style 속성 확인 (색상 등) - span, div 포함 모든 요소
  const elementsWithStyle = doc.body.querySelectorAll('[style]');
  if (elementsWithStyle.length > 0) {
    for (const el of elementsWithStyle) {
      const style = el.getAttribute('style') || '';
      // VS Code 등 코드 에디터에서 복사 시 color 스타일이 포함됨
      if (/color|background|font/i.test(style)) return true;
    }
  }
  
  // VS Code 특유의 data 속성 확인 (vscode-*)
  if (doc.body.querySelector('[class*="vscode"]') || 
      doc.body.querySelector('[data-vscode]') ||
      html.includes('vscode-')) {
    return true;
  }
  
  // Monaco Editor (VS Code의 에디터 엔진) 클래스 확인
  if (doc.body.querySelector('[class*="monaco"]') ||
      doc.body.querySelector('[class*="mtk"]')) {
    return true;
  }
  
  // 여러 개의 span이 색상 스타일을 가진 경우 (코드 하이라이팅 패턴)
  const spans = doc.body.querySelectorAll('span');
  let coloredSpanCount = 0;
  for (const span of spans) {
    const style = span.getAttribute('style') || '';
    if (/color\s*:/i.test(style)) {
      coloredSpanCount++;
      if (coloredSpanCount >= 2) return true; // 2개 이상의 컬러 span이 있으면 서식으로 판단
    }
  }
  
  return false;
};
