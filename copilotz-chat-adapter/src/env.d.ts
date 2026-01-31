interface ImportMetaEnv {
  [key: string]: string | undefined;
}

interface ImportMeta {
  env?: ImportMetaEnv;
}

declare const process: { env?: Record<string, string | undefined> } | undefined;
