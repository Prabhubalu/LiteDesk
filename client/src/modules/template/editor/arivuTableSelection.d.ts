export {};

declare global {
  interface Document {
    __arivuTableSelectionHandlers?: {
      onMouseDown: (event: MouseEvent) => void;
      onTrackModifiers: (event: MouseEvent) => void;
    };
  }
}
