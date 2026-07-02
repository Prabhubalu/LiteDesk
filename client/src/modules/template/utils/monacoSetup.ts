import type { editor as MonacoEditor } from 'monaco-editor';

type MonacoModule = typeof import('monaco-editor');

let monacoPromise: Promise<MonacoModule> | null = null;

function configureMonacoEnvironment() {
  if (typeof globalThis === 'undefined') return;
  const global = globalThis as typeof globalThis & {
    MonacoEnvironment?: {
      getWorker: (workerId: string, label: string) => Worker;
    };
  };

  if (global.MonacoEnvironment) return;

  global.MonacoEnvironment = {
    getWorker(_workerId, label) {
      if (label === 'json') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url),
          { type: 'module' }
        );
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url),
          { type: 'module' }
        );
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url),
          { type: 'module' }
        );
      }
      return new Worker(
        new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
        { type: 'module' }
      );
    }
  };
}

export async function loadMonaco(): Promise<MonacoModule> {
  if (!monacoPromise) {
    configureMonacoEnvironment();
    monacoPromise = import('monaco-editor');
  }
  return monacoPromise;
}

export function resolveMonacoTheme(): 'vs' | 'vs-dark' {
  if (typeof document === 'undefined') return 'vs';
  return document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs';
}

export type MonacoEditorInstance = MonacoEditor.IStandaloneCodeEditor;
