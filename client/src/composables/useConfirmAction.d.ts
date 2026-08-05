export type ConfirmActionTone = 'danger' | 'warning' | 'success';

export type ConfirmActionOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  tone?: ConfirmActionTone;
};

export type ConfirmActionChoiceOptions = ConfirmActionOptions & {
  secondaryLabel: string;
  cancelLabel?: string;
};

export type ConfirmActionChoiceResult = 'confirm' | 'secondary' | 'cancel';

export declare const confirmActionState: {
  show: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  secondaryLabel: string;
  cancelLabel: string;
  tone: ConfirmActionTone;
  mode: 'boolean' | 'choice';
  resolving: ((result: unknown) => void) | null;
};

export declare function confirmAction(
  options: string | ConfirmActionOptions
): Promise<boolean>;

export declare function confirmActionChoice(
  options: ConfirmActionChoiceOptions
): Promise<ConfirmActionChoiceResult>;

export declare function resolveConfirmAction(
  result: boolean | ConfirmActionChoiceResult
): void;
