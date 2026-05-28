import {
  downloadCommunicationAttachment,
  fetchCommunicationAttachmentBlob
} from '@/utils/communicationAttachments';
import {
  downloadMailroomAttachment,
  fetchMailroomAttachmentBlob,
  formatMailroomAttachmentSize,
  isMailroomImageMime,
  isMailroomPreviewableMime
} from '@/utils/mailroomAttachments';

/**
 * Normalize thread/activity attachment shapes for the case email timeline.
 * Outbound comm emails use storagePath; inbound mailroom uses Mongo _id.
 */
export function normalizeCaseEmailAttachment(raw, idx = 0) {
  const storagePath = String(raw?.storagePath || '').trim();
  const mailroomId = raw?._id || raw?.id || null;
  const originalFileName = raw?.originalFileName || raw?.fileName || 'attachment';
  const mimeType = raw?.mimeType || raw?.contentType || raw?.fileType || '';
  const sizeBytes = Number(raw?.sizeBytes ?? raw?.fileSize ?? 0) || 0;

  if (storagePath) {
    return {
      id: `storage:${storagePath}`,
      storagePath,
      mailroomId: null,
      originalFileName,
      sizeBytes,
      mimeType
    };
  }

  if (mailroomId) {
    return {
      id: String(mailroomId),
      storagePath: null,
      mailroomId: String(mailroomId),
      originalFileName,
      sizeBytes,
      mimeType
    };
  }

  return {
    id: `att-${idx}`,
    storagePath: null,
    mailroomId: null,
    originalFileName,
    sizeBytes,
    mimeType
  };
}

export function getCaseEmailAttachmentKey(att) {
  return att?.storagePath || att?.mailroomId || att?.id || '';
}

export function caseEmailAttachmentIsAccessible(att) {
  return Boolean(att?.storagePath || att?.mailroomId);
}

export async function fetchCaseEmailAttachmentBlob(att, { disposition = 'attachment' } = {}) {
  const storagePath = String(att?.storagePath || '').trim();
  if (storagePath) {
    const { blob, contentType } = await fetchCommunicationAttachmentBlob(storagePath, {
      disposition,
      fileName: att.originalFileName,
      contentType: att.mimeType
    });
    return { blob, contentType: contentType || att.mimeType || 'application/octet-stream' };
  }

  const mailroomId = att?.mailroomId || att?.id;
  if (mailroomId && !String(mailroomId).startsWith('att-') && !String(mailroomId).startsWith('storage:')) {
    return fetchMailroomAttachmentBlob(mailroomId, { disposition });
  }

  throw new Error('Attachment reference missing');
}

export async function downloadCaseEmailAttachment(att, { disposition = 'attachment' } = {}) {
  const storagePath = String(att?.storagePath || '').trim();
  if (storagePath) {
    await downloadCommunicationAttachment(
      {
        storagePath,
        fileName: att.originalFileName,
        fileType: att.mimeType
      },
      { disposition }
    );
    return;
  }

  const mailroomId = att?.mailroomId || att?.id;
  if (mailroomId) {
    await downloadMailroomAttachment(
      { id: mailroomId, _id: mailroomId, originalFileName: att.originalFileName },
      { disposition }
    );
  }
}

export { formatMailroomAttachmentSize, isMailroomImageMime, isMailroomPreviewableMime };
