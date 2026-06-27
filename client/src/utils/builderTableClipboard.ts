import { cloneCell, type TableGridCell } from '@/utils/builderTableGridModel';

let clipboardCell: TableGridCell | null = null;

export function copyTableCell(cell: TableGridCell): void {
  clipboardCell = cloneCell(cell);
}

export function readTableClipboard(): TableGridCell | null {
  return clipboardCell ? cloneCell(clipboardCell) : null;
}

export function hasTableClipboard(): boolean {
  return clipboardCell != null;
}
