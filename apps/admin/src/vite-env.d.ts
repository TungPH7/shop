/// <reference types="vite/client" />

// Typed access to our custom env variables. Vite only exposes vars prefixed
// with `VITE_` to client code. Extend this interface for every new VITE_* var
// so `import.meta.env.X` is type-checked across the app.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
