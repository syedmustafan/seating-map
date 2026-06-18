/// <reference types="vite/client" />

// Typed access to the optional backend-integration env var. Unset in standalone
// mode, so it is declared optional and the loader falls back to the static file.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
