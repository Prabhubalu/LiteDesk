export interface CaseCannedResponseMergeTag {
  token: string;
  labelKey: string;
  descriptionKey: string;
}

export interface CaseCannedResponseMergeTagGroup {
  id: string;
  labelKey: string;
  tags: CaseCannedResponseMergeTag[];
}

export interface CaseCannedResponseMergeTagListItem extends CaseCannedResponseMergeTag {
  groupId: string;
  groupLabelKey: string;
}

export declare const CASE_CANNED_RESPONSE_MERGE_TAG_GROUPS: CaseCannedResponseMergeTagGroup[];

export function formatCaseCannedResponseMergeTag(token: string): string;

export function listCaseCannedResponseMergeTags(): CaseCannedResponseMergeTagListItem[];
