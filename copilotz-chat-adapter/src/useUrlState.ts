import { useCallback, useEffect, useRef } from 'react';

const readThreadId = () =>
  typeof window === 'undefined'
    ? null
    : new URL(window.location.href).searchParams.get('thread');

/** Synchronizes the selected conversation with the browser's URL and navigation. */
export interface ThreadNavigation {
  threadId: string | null;
  onChange: (threadId: string | null) => void;
}

export function useUrlState(onNavigate: (threadId: string | null) => void, controlled?: ThreadNavigation) {
  const initialThreadId = useRef(controlled ? controlled.threadId : readThreadId());
  const navigate = useRef(onNavigate);
  navigate.current = onNavigate;
  const owner = useRef(controlled);
  owner.current = controlled;
  useEffect(() => {
    if (controlled) return;
    const popstate = () => navigate.current(readThreadId());
    window.addEventListener('popstate', popstate);
    return () => window.removeEventListener('popstate', popstate);
  }, [Boolean(controlled)]);
  useEffect(() => {
    if (controlled) navigate.current(controlled.threadId);
  }, [controlled?.threadId]);
  const setThreadId = useCallback((threadId: string | null) => {
    if (owner.current) {
      owner.current.onChange(threadId);
      return;
    }
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (threadId) url.searchParams.set('thread', threadId);
    else url.searchParams.delete('thread');
    if (url.href !== window.location.href)
      window.history.replaceState({}, '', url);
  }, []);
  return { initialThreadId: initialThreadId.current, setThreadId };
}
