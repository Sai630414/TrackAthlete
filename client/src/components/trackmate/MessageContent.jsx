import React, { useMemo } from 'react';

/**
 * Renders a deliberately small Markdown subset as React elements.
 *
 * There is no `dangerouslySetInnerHTML` anywhere in this file, and no Markdown
 * library: model output is parsed into a fixed set of elements (paragraph, list,
 * bold, italic, inline code, link) and anything unrecognised falls through as
 * plain text. That makes XSS through generated content structurally impossible
 * rather than a matter of escaping correctly.
 *
 * Links are additionally restricted to absolute http(s) URLs, so `javascript:`,
 * `data:` and relative hrefs can never be produced.
 */

const INLINE_PATTERN =
  /(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(`[^`\n]+`)|(\[[^\]\n]+\]\([^\s)]+\))/g;

const LINK_PATTERN = /^\[([^\]\n]+)\]\(([^\s)]+)\)$/;

function safeHref(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function renderInline(text, keyPrefix) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  let i = 0;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('[')) {
      const link = token.match(LINK_PATTERN);
      const href = link ? safeHref(link[2]) : null;
      if (href) {
        nodes.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">
            {link[1]}
          </a>
        );
      } else {
        // Unsafe or malformed URL: keep the label, drop the link entirely.
        nodes.push(link ? link[1] : token);
      }
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/** Split raw text into paragraph / unordered-list / ordered-list blocks. */
function toBlocks(text) {
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    // Headings are flattened to a bold line — the panel is too small for real headings.
    const heading = line.match(/^#{1,6}\s+(.*)$/);

    if (bullet || ordered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((bullet || ordered)[1]);
      continue;
    }

    flushList();
    if (heading) {
      flushParagraph();
      blocks.push({ type: 'p', text: `**${heading[1]}**` });
      continue;
    }
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

export default function MessageContent({ text }) {
  const blocks = useMemo(() => toBlocks(String(text || '')), [text]);

  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === 'p') {
          return <p key={index}>{renderInline(block.text, `b${index}`)}</p>;
        }
        const ListTag = block.type === 'ol' ? 'ol' : 'ul';
        return (
          <ListTag key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item, `b${index}-${itemIndex}`)}</li>
            ))}
          </ListTag>
        );
      })}
    </>
  );
}
