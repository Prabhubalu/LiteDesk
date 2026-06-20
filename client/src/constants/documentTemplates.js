/**
 * Phase 3 — seeded rich document templates.
 */
export const DOCUMENT_TEMPLATE_BLANK = {
  id: 'blank',
  documentType: 'rich_document',
  titleKey: 'documents.templateBlank',
  descriptionKey: 'documents.templateBlankHint'
};

export const DOCUMENT_TEMPLATES = [
  DOCUMENT_TEMPLATE_BLANK,
  {
    id: 'meeting_notes',
    documentType: 'meeting_notes',
    titleKey: 'documents.templateMeetingNotes',
    descriptionKey: 'documents.templateMeetingNotesHint',
    defaultTitleKey: 'documents.templateMeetingNotesTitle',
    richContentHtml: `
<h2>Meeting Notes</h2>
<p><strong>Date:</strong> </p>
<p><strong>Attendees:</strong> </p>
<p><strong>Agenda:</strong></p>
<ul><li></li></ul>
<p><strong>Discussion:</strong></p>
<p></p>
<p><strong>Action items:</strong></p>
<ul><li></li></ul>
<p><strong>Next steps:</strong></p>
<p></p>
`.trim()
  },
  {
    id: 'rca',
    documentType: 'sop',
    titleKey: 'documents.templateRca',
    descriptionKey: 'documents.templateRcaHint',
    defaultTitleKey: 'documents.templateRcaTitle',
    richContentHtml: `
<h2>Root Cause Analysis</h2>
<p><strong>Incident summary:</strong></p>
<p></p>
<p><strong>Impact:</strong></p>
<p></p>
<p><strong>Timeline:</strong></p>
<ol><li></li></ol>
<p><strong>Root cause:</strong></p>
<p></p>
<p><strong>Corrective actions:</strong></p>
<ul><li></li></ul>
<p><strong>Preventive actions:</strong></p>
<ul><li></li></ul>
`.trim()
  },
  {
    id: 'installation_checklist',
    documentType: 'checklist',
    titleKey: 'documents.templateInstallationChecklist',
    descriptionKey: 'documents.templateInstallationChecklistHint',
    defaultTitleKey: 'documents.templateInstallationChecklistTitle',
    richContentHtml: `
<h2>Installation Checklist</h2>
<p><strong>Site / customer:</strong> </p>
<p><strong>Scheduled date:</strong> </p>
<p><strong>Pre-installation:</strong></p>
<ul><li>Confirm site access and safety requirements</li><li>Verify equipment and materials on hand</li><li>Review installation scope with customer</li></ul>
<p><strong>Installation steps:</strong></p>
<ul><li></li><li></li><li></li></ul>
<p><strong>Post-installation:</strong></p>
<ul><li>Run acceptance tests</li><li>Capture customer sign-off</li><li>Attach photos and documentation</li></ul>
<p><strong>Notes:</strong></p>
<p></p>
`.trim()
  }
];
