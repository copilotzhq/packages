import { useCallback, useEffect, useRef } from 'react';

const readThreadId = () =>
  typeof window === 'undefined'
    ? null
    : new URL(window.location.href).searchParams.get('thread');

/** Synchronizes the selected conversation with the browser's URL and navigation. */
export function useUrlState(onNavigate: (threadId: string | null) => void) {
  const initialThreadId = useRef(readThreadId());
  const navigate = useRef(onNavigate);
  navigate.current = onNavigate;
  useEffect(() => {
    const popstate = () => navigate.current(readThreadId());
    window.addEventListener('popstate', popstate);
    return () => window.removeEventListener('popstate', popstate);
  }, []);
  const setThreadId = useCallback((threadId: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (threadId) url.searchParams.set('thread', threadId);
    else url.searchParams.delete('thread');
    if (url.href !== window.location.href)
      window.history.replaceState({}, '', url);
  }, []);
  return { initialThreadId: initialThreadId.current, setThreadId };
}
