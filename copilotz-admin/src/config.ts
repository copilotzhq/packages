import type { LegacyAdminConfig } from "./core/types";

export const defaultAdminConfig: LegacyAdminConfig = {
  baseUrl: "",
  branding: {
    subtitle: "Operate and configure Copilotz projects",
    title: "Copilotz Admin",
  },
  namespace: "",
};

export function mergeAdminConfig(
  baseConfig: LegacyAdminConfig = defaultAdminConfig,
  userConfig?: LegacyAdminConfig,
): LegacyAdminConfig {
  return {
    ...baseConfig,
    ...(userConfig ?? {}),
    branding: {
      ...(baseConfig.branding ?? {}),
      ...(userConfig?.branding ?? {}),
    },
  };
}
