// / <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    // You can add other VITE_ prefixed environment variables here if needed
    // Example: readonly VITE_MY_OTHER_VARIABLE: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
      // Add other process.env variables here if defined in vite.config.ts 'define' block
    }
  }
}

export {}; // Ensures the file is treated as a module, allowing global augmentations.