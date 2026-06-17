import {
  Bars3BottomLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CircleStackIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  HashtagIcon,
  LinkIcon,
  PhoneIcon,
  PhotoIcon,
  PaperClipIcon
} from '@heroicons/vue/24/outline';

export const WEBFORM_BUILDER_STEPS = ['build', 'configure', 'automate', 'publish'];

const CATEGORY_ICONS = Object.freeze({
  text: Bars3BottomLeftIcon,
  textarea: DocumentTextIcon,
  richText: DocumentTextIcon,
  number: HashtagIcon,
  date: CalendarDaysIcon,
  datetime: CalendarDaysIcon,
  picklist: ChevronDownIcon,
  multiPicklist: ChevronDownIcon,
  checkbox: CheckCircleIcon,
  radio: CheckCircleIcon,
  email: EnvelopeIcon,
  phone: PhoneIcon,
  url: LinkIcon,
  image: PhotoIcon,
  file: PaperClipIcon,
  lookup: CircleStackIcon,
  currency: CurrencyDollarIcon
});

const TYPE_ICON_OVERRIDES = Object.freeze({
  Currency: CurrencyDollarIcon,
  Email: EnvelopeIcon,
  URL: LinkIcon
});

/**
 * Build draggable palette entries from API field-type metadata.
 * @param {Array<{ type: string, category?: string }>} fieldTypes
 * @param {(type: string) => string} labelForType
 */
export function buildWebformFieldPalette(fieldTypes, labelForType) {
  return (fieldTypes || []).map((row) => {
    const type = row.type;
    const icon = TYPE_ICON_OVERRIDES[type] || CATEGORY_ICONS[row.category] || Bars3BottomLeftIcon;
    return {
      type,
      label: labelForType(type),
      icon
    };
  });
}

export function fallbackWebformFieldPalette(labelForType) {
  return buildWebformFieldPalette(
    [
      { type: 'Text', category: 'text' },
      { type: 'Text-Area', category: 'textarea' },
      { type: 'Email', category: 'email' },
      { type: 'Phone', category: 'phone' },
      { type: 'Integer', category: 'number' },
      { type: 'Picklist', category: 'picklist' },
      { type: 'Checkbox', category: 'checkbox' },
      { type: 'Date', category: 'date' }
    ],
    labelForType
  );
}

/** @deprecated Use buildWebformFieldPalette with API metadata */
export const WEBFORM_BUILDER_FIELD_PALETTE = [];
