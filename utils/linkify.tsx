import React from 'react';

// URL regex pattern - matches http, https, and www URLs
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;

/**
 * Converts text containing URLs into React elements with clickable links
 */
export function linkifyText(text: string, className?: string): React.ReactNode {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  // Reset regex state
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Get the URL and ensure it has a protocol
    let url = match[0];
    const href = url.startsWith('www.') ? `https://${url}` : url;

    // Add the clickable link
    parts.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={className || "text-indigo-600 hover:text-indigo-700 hover:underline break-all"}
      >
        {url}
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no URLs found, return original text
  if (parts.length === 0) {
    return text;
  }

  return <>{parts}</>;
}

/**
 * Check if text contains any URLs
 */
export function containsUrl(text: string): boolean {
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text);
}
