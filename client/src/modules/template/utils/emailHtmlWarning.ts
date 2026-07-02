const STORAGE_KEY = 'litedesk.emailHtmlWarningDismissed';

export function isEmailHtmlWarningDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissEmailHtmlWarning(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore storage failures
  }
}
