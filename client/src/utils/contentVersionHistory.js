import DOMPurify from 'dompurify';
import { sanitizeRichDescriptionHtml } from '@/utils/richDescriptionHtml';

export function formatContentVersionDate(date) {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function getPlainTextFromHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function diffWordsToHtml(oldText, newText) {
  const oldParts = String(oldText || '').split(/(\s+)/);
  const newParts = String(newText || '').split(/(\s+)/);
  const escape = (value) => {
    const el = document.createElement('div');
    el.textContent = value;
    return el.innerHTML;
  };
  const result = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldParts.length || newIndex < newParts.length) {
    if (oldIndex < oldParts.length && newIndex < newParts.length && oldParts[oldIndex] === newParts[newIndex]) {
      result.push(escape(oldParts[oldIndex]));
      oldIndex += 1;
      newIndex += 1;
      continue;
    }
    if (newIndex < newParts.length && !oldParts.slice(oldIndex).includes(newParts[newIndex])) {
      result.push(`<ins class="bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200 no-underline">${escape(newParts[newIndex])}</ins>`);
      newIndex += 1;
      continue;
    }
    if (oldIndex < oldParts.length) {
      result.push(`<del class="bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 line-through">${escape(oldParts[oldIndex])}</del>`);
      oldIndex += 1;
      continue;
    }
    if (newIndex < newParts.length) {
      result.push(`<ins class="bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200 no-underline">${escape(newParts[newIndex])}</ins>`);
      newIndex += 1;
    }
  }
  return result.join('');
}

export function buildContentVersionHistoryList({ record, versions, currentContent, currentUserName }) {
  if (!record) return [];
  const current = {
    isCurrent: true,
    createdAt: record.updatedAt || record.createdAt || new Date(),
    createdBy: null,
    content: currentContent ?? ''
  };
  const list = [{ ...current, createdBy: currentUserName || 'You' }];
  (versions || []).forEach((version) => {
    list.push({
      isCurrent: false,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      content: version.content
    });
  });
  return list;
}

export function getSelectedVersionContent(historyList, selectedIndex) {
  const selected = historyList[selectedIndex];
  const raw = String(selected?.content || '');
  if (!raw.trim()) return '';
  return sanitizeRichDescriptionHtml(raw);
}

export function getVersionDiffHtml(historyList, selectedIndex) {
  if (historyList.length <= 1 || selectedIndex <= 0) return '';
  const currentVersion = historyList[0];
  const selectedVersion = historyList[selectedIndex];
  if (!currentVersion || !selectedVersion) return '';
  const oldPlain = getPlainTextFromHtml(selectedVersion.content);
  const newPlain = getPlainTextFromHtml(currentVersion.content);
  const diffHtml = diffWordsToHtml(oldPlain, newPlain);
  return DOMPurify.sanitize(diffHtml, { ALLOWED_TAGS: ['ins', 'del'], ALLOWED_ATTR: ['class'] });
}
