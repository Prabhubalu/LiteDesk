import type { ProseMirrorJson } from '../types/contentStudio';

export interface DocumentHeadingItem {
  level: number;
  text: string;
  index: number;
}

function collectText(node: ProseMirrorJson): string {
  if (node.type === 'text') return node.text || '';
  return (node.content || []).map(collectText).join(' ');
}

export function extractPlainTextFromBlocks(blocks: ProseMirrorJson | null | undefined, extra = ''): string {
  const parts: string[] = [];
  if (extra.trim()) parts.push(extra.trim());
  if (blocks?.type === 'doc') {
    for (const node of blocks.content || []) {
      const text = collectText(node).trim();
      if (text) parts.push(text);
    }
  }
  return parts.join(' ');
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function estimateReadMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 200));
}

export function extractHeadingsFromBlocks(blocks: ProseMirrorJson | null | undefined): DocumentHeadingItem[] {
  if (blocks?.type !== 'doc') return [];
  const headings: DocumentHeadingItem[] = [];
  let index = 0;
  for (const node of blocks.content || []) {
    if (node.type === 'heading') {
      const text = collectText(node).trim() || `Heading ${index + 1}`;
      headings.push({
        level: Number(node.attrs?.level) || 2,
        text,
        index,
      });
      index += 1;
    }
  }
  return headings;
}
