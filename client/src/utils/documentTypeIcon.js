import {
  ArchiveBoxIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  LinkIcon,
  PhotoIcon,
  PresentationChartBarIcon,
  SparklesIcon,
  TableCellsIcon
} from '@heroicons/vue/24/outline';
import { isFileDocument } from '@/utils/documentRichContent';

const RICH_TYPE_ICONS = {
  external_link: { icon: LinkIcon, className: 'text-blue-500 dark:text-blue-400' },
  knowledge_article: { icon: BookOpenIcon, className: 'text-indigo-500 dark:text-indigo-400' },
  playbook: { icon: SparklesIcon, className: 'text-rose-500 dark:text-rose-400' },
  meeting_notes: { icon: CalendarDaysIcon, className: 'text-sky-500 dark:text-sky-400' },
  sop: { icon: ClipboardDocumentCheckIcon, className: 'text-violet-500 dark:text-violet-400' },
  checklist: { icon: ClipboardDocumentListIcon, className: 'text-emerald-500 dark:text-emerald-400' },
  template: { icon: DocumentDuplicateIcon, className: 'text-amber-500 dark:text-amber-400' },
  generated_document: { icon: DocumentTextIcon, className: 'text-indigo-500 dark:text-indigo-400' }
};

const DEFAULT_RICH_ICON = {
  icon: DocumentTextIcon,
  className: 'text-indigo-500 dark:text-indigo-400'
};

const DEFAULT_FILE_ICON = {
  icon: DocumentDuplicateIcon,
  className: 'text-gray-400 dark:text-gray-500'
};

function resolveFileTypeIcon(doc) {
  const fileType = String(doc?.fileType || '').toUpperCase();
  const mime = String(doc?.mimeType || '').toLowerCase();

  if (fileType === 'PDF' || mime === 'application/pdf') {
    return { icon: DocumentTextIcon, className: 'text-red-500 dark:text-red-400' };
  }
  if (fileType === 'DOCX' || mime.includes('word') || mime.includes('msword')) {
    return { icon: DocumentTextIcon, className: 'text-blue-500 dark:text-blue-400' };
  }
  if (fileType === 'XLSX' || mime.includes('sheet') || mime.includes('excel')) {
    return { icon: TableCellsIcon, className: 'text-green-600 dark:text-green-400' };
  }
  if (fileType === 'PPTX' || mime.includes('presentation') || mime.includes('powerpoint')) {
    return { icon: PresentationChartBarIcon, className: 'text-orange-500 dark:text-orange-400' };
  }
  if (fileType === 'IMAGE' || mime.startsWith('image/')) {
    return { icon: PhotoIcon, className: 'text-purple-500 dark:text-purple-400' };
  }
  if (fileType === 'ZIP' || mime.includes('zip') || mime.includes('compressed')) {
    return { icon: ArchiveBoxIcon, className: 'text-gray-500 dark:text-gray-400' };
  }

  return DEFAULT_FILE_ICON;
}

export function resolveDocumentTypeIcon(doc) {
  const documentType = String(doc?.documentType || 'file');
  if (RICH_TYPE_ICONS[documentType]) {
    return RICH_TYPE_ICONS[documentType];
  }
  if (isFileDocument(doc)) {
    return resolveFileTypeIcon(doc);
  }
  return DEFAULT_RICH_ICON;
}
