export type ConfirmActionTone = 'danger' | 'warning' | 'success';

export type ConfirmActionOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  tone?: ConfirmActionTone;
};

export declare const confirmActionState: {
  show: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone: ConfirmActionTone;
  resolving: ((ok: boolean) => void) | null;
};

export declare function confirmAction(
  options: string | ConfirmActionOptions
): Promise<boolean>;

export declare function resolveConfirmAction(confirmed: boolean): void;
