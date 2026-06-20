/**
 * Documents module activity UI — audit/system event messages.
 */

const DOCUMENT_ACTIVITY_MESSAGES = {
  upload: 'Uploaded document',
  preview: 'Previewed document',
  download: 'Downloaded document',
  share: 'Shared document',
  delete: 'Moved document to trash',
  restore: 'Restored document',
  version_change: 'Uploaded a new version',
  ownership_change: 'Changed document owner',
  create: 'Created document',
  update: 'Updated document'
};

export function getDocumentActivityMessage(event) {
  if (!event) return null;
  const action = String(event?.action || event?.payload?.action || '').trim();
  const msg = String(event?.message ?? event?.payload?.message ?? '').trim();
  if (msg) return msg;
  if (DOCUMENT_ACTIVITY_MESSAGES[action]) return DOCUMENT_ACTIVITY_MESSAGES[action];
  if (action === 'version_change') {
    const version = event?.details?.versionNumber ?? event?.payload?.details?.versionNumber;
    if (version) return `Uploaded version ${version}`;
  }
  return null;
}
