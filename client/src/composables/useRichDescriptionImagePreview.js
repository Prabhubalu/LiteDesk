import { ref } from 'vue';

/**
 * Shared open/close state for rich-description (and rich-content) image expand.
 */
export function useRichDescriptionImagePreview() {
  const showImagePreview = ref(false);
  const previewImageSrc = ref('');

  const closeImagePreview = () => {
    showImagePreview.value = false;
    previewImageSrc.value = '';
  };

  const openImagePreview = (imgOrSrc) => {
    const src = typeof imgOrSrc === 'string'
      ? String(imgOrSrc || '').trim()
      : String(imgOrSrc?.currentSrc || imgOrSrc?.src || '').trim();
    if (!src) return;
    previewImageSrc.value = src;
    showImagePreview.value = true;
  };

  /**
   * @param {MouseEvent} event
   * @param {{ onNonImage?: (event: MouseEvent) => void }} [options]
   * @returns {boolean} true when an image was opened
   */
  const handleRichHtmlClick = (event, options = {}) => {
    const target = event?.target;
    if (target instanceof HTMLImageElement) {
      event.preventDefault();
      event.stopPropagation();
      openImagePreview(target);
      return true;
    }
    options.onNonImage?.(event);
    return false;
  };

  return {
    showImagePreview,
    previewImageSrc,
    openImagePreview,
    closeImagePreview,
    handleRichHtmlClick
  };
}
