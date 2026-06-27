export function usePortalCaseReadState() {
  function isCaseUnread(caseItem) {
    if (caseItem?.isUnread === true) return true;
    if (caseItem?.needsCustomerAction) return true;
    return false;
  }

  function unreadCount(cases) {
    return (Array.isArray(cases) ? cases : []).filter((item) => isCaseUnread(item)).length;
  }

  return {
    isCaseUnread,
    unreadCount
  };
}
