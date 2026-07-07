<template>
  <component :is="iconComponent" v-if="iconComponent" class="h-6 w-6 shrink-0 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
  <span v-else class="font-serif text-xl leading-none text-neutral-600 dark:text-neutral-300">{{ serifLabel }}</span>
</template>

<script setup>
import { computed } from 'vue';
import {
  Bars3BottomLeftIcon,
  PhotoIcon,
  ListBulletIcon,
  ChatBubbleBottomCenterTextIcon,
  MinusIcon,
  RectangleGroupIcon,
  PlayCircleIcon,
  MusicalNoteIcon,
  DocumentIcon,
  CodeBracketIcon,
  GlobeAltIcon,
  TableCellsIcon,
  RectangleStackIcon,
  ChevronDownIcon,
  MegaphoneIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
  NumberedListIcon,
  LightBulbIcon,
  ViewColumnsIcon,
  SquaresPlusIcon,
  ArrowsUpDownIcon,
  CursorArrowRaysIcon,
  BookOpenIcon,
  MapPinIcon,
  DocumentTextIcon,
  ShareIcon,
  StarIcon,
  ChartBarIcon,
  CheckCircleIcon,
} from '@heroicons/vue/24/outline';

const ICONS = {
  paragraph: Bars3BottomLeftIcon,
  heading: null,
  image: PhotoIcon,
  list: ListBulletIcon,
  quote: ChatBubbleBottomCenterTextIcon,
  divider: MinusIcon,
  gallery: RectangleGroupIcon,
  video: PlayCircleIcon,
  audio: MusicalNoteIcon,
  file: DocumentIcon,
  code: CodeBracketIcon,
  embed: GlobeAltIcon,
  table: TableCellsIcon,
  tabs: RectangleStackIcon,
  accordion: ChevronDownIcon,
  callout: MegaphoneIcon,
  alert: ExclamationTriangleIcon,
  timeline: ClockIcon,
  faq: QuestionMarkCircleIcon,
  steps: NumberedListIcon,
  howto: LightBulbIcon,
  columns: ViewColumnsIcon,
  section: SquaresPlusIcon,
  spacer: ArrowsUpDownIcon,
  button: CursorArrowRaysIcon,
  toc: BookOpenIcon,
  map: MapPinIcon,
  form: DocumentTextIcon,
  social: ShareIcon,
  rating: StarIcon,
  progress: ChartBarIcon,
  checklist: CheckCircleIcon,
};

const props = defineProps({
  icon: { type: String, required: true },
});

const iconComponent = computed(() => {
  if (props.icon === 'heading') return null;
  return ICONS[props.icon] ?? Bars3BottomLeftIcon;
});

const serifLabel = computed(() => {
  if (props.icon === 'heading') return 'H';
  return props.icon.slice(0, 1).toUpperCase();
});
</script>
