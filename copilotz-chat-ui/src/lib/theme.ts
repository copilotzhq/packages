export type ChatThemePreference = 'light' | 'dark' | 'auto';

/**
 * Whether the page should be dark for a host-configured theme. A choice the
 * person saved with the header toggle wins over the host's default; `auto`
 * follows the system.
 */
export const resolveDarkMode = (
  configured: ChatThemePreference,
  saved: string | null,
  systemPrefersDark: boolean,
): boolean => {
  const preference = saved === 'light' || saved === 'dark' ? saved : configured;
  return preference === 'dark' || (preference === 'auto' && systemPrefersDark);
};
