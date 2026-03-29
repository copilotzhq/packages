import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Configuration for URL parameter names
 */
export interface UrlParamsConfig {
  /** URL param name for thread ID (default: 'thread') */
  thread?: string;
  /** URL param name for agent ID (default: 'agent') */
  agent?: string;
  /** URL param name for initial prompt (default: 'prompt') */
  prompt?: string;
}

/**
 * URL sync behavior configuration
 */
export interface UrlSyncConfig {
  /** Enable/disable URL sync (default: true) */
  enabled?: boolean;
  /** 
   * How to update the URL when state changes:
   * - 'push': Creates browser history entries (back button works)
   * - 'replace': Updates URL without history entries (default)
   * - 'read-only': Only reads from URL, never writes
   */
  mode?: 'push' | 'replace' | 'read-only';
  /** Custom parameter names */
  params?: UrlParamsConfig;
  /**
   * Behavior for the prompt parameter:
   * - 'prefill': Pre-fills the input field (default)
   * - 'auto-send': Automatically sends the message on load
   */
  promptBehavior?: 'prefill' | 'auto-send';
  /**
   * Whether to clear the prompt param from URL after reading
   * Prevents re-sending on refresh (default: true)
   */
  clearPromptAfterRead?: boolean;
}

/**
 * State values parsed from URL
 */
export interface UrlState {
  threadId: string | null;
  agentId: string | null;
  prompt: string | null;
}

/**
 * Return type of useUrlState hook
 */
export interface UseUrlStateReturn {
  /** Current state parsed from URL */
  state: UrlState;
  /** Update thread ID in URL */
  setThreadId: (threadId: string | null) => void;
  /** Update agent ID in URL */
  setAgentId: (agentId: string | null) => void;
  /** Clear prompt from URL (call after consuming it) */
  clearPrompt: () => void;
  /** Whether URL sync is enabled */
  isEnabled: boolean;
}

const DEFAULT_PARAMS: Required<UrlParamsConfig> = {
  thread: 'thread',
  agent: 'agent',
  prompt: 'prompt',
};

/**
 * Check if we're in a browser environment
 */
const isBrowser = typeof globalThis !== 'undefined' && typeof globalThis.location !== 'undefined';

/**
 * Get current URL search params (SSR-safe)
 */
const getSearchParams = (): URLSearchParams => {
  if (!isBrowser) return new URLSearchParams();
  return new URLSearchParams(globalThis.location.search);
};

/**
 * Update URL with new search params
 */
const updateUrl = (params: URLSearchParams, mode: 'push' | 'replace') => {
  if (!isBrowser) return;
  
  const url = new URL(globalThis.location.href);
  url.search = params.toString();
  
  if (mode === 'push') {
    globalThis.history.pushState({}, '', url.toString());
  } else {
    globalThis.history.replaceState({}, '', url.toString());
  }
};

/**
 * Hook to manage chat state persistence via URL parameters.
 */
export function useUrlState(config: UrlSyncConfig = {}): UseUrlStateReturn {
  const {
    enabled = true,
    mode = 'replace',
    params: userParams = {},
    clearPromptAfterRead = true,
  } = config;

  const params = { ...DEFAULT_PARAMS, ...userParams };
  const isReadOnly = mode === 'read-only';
  const updateMode = mode === 'read-only' ? 'replace' : mode;

  const initialReadDone = useRef(false);
  const promptCleared = useRef(false);

  const parseUrlState = useCallback((): UrlState => {
    if (!enabled || !isBrowser) {
      return { threadId: null, agentId: null, prompt: null };
    }

    const searchParams = getSearchParams();
    
    return {
      threadId: searchParams.get(params.thread) || null,
      agentId: searchParams.get(params.agent) || null,
      prompt: promptCleared.current ? null : (searchParams.get(params.prompt) || null),
    };
  }, [enabled, params.thread, params.agent, params.prompt]);

  const [state, setState] = useState<UrlState>(parseUrlState);

  // Read URL state on mount and handle popstate (back/forward navigation)
  useEffect(() => {
    if (!enabled || !isBrowser) return;

    if (!initialReadDone.current) {
      const initialState = parseUrlState();
      setState(initialState);
      initialReadDone.current = true;

      if (clearPromptAfterRead && initialState.prompt && !isReadOnly) {
        const searchParams = getSearchParams();
        searchParams.delete(params.prompt);
        updateUrl(searchParams, 'replace');
        promptCleared.current = true;
      }
    }

    const handlePopState = () => {
      setState(parseUrlState());
    };

    globalThis.addEventListener('popstate', handlePopState);
    return () => globalThis.removeEventListener('popstate', handlePopState);
  }, [enabled, parseUrlState, clearPromptAfterRead, params.prompt, isReadOnly]);

  const setThreadId = useCallback((threadId: string | null) => {
    if (!enabled || isReadOnly || !isBrowser) return;

    const searchParams = getSearchParams();
    if (threadId) {
      searchParams.set(params.thread, threadId);
    } else {
      searchParams.delete(params.thread);
    }
    updateUrl(searchParams, updateMode);
    setState((prev) => ({ ...prev, threadId }));
  }, [enabled, isReadOnly, params.thread, updateMode]);

  const setAgentId = useCallback((agentId: string | null) => {
    if (!enabled || isReadOnly || !isBrowser) return;

    const searchParams = getSearchParams();
    if (agentId) {
      searchParams.set(params.agent, agentId);
    } else {
      searchParams.delete(params.agent);
    }
    updateUrl(searchParams, updateMode);
    setState((prev) => ({ ...prev, agentId }));
  }, [enabled, isReadOnly, params.agent, updateMode]);

  const clearPrompt = useCallback(() => {
    if (!enabled || isReadOnly || !isBrowser) return;

    const searchParams = getSearchParams();
    searchParams.delete(params.prompt);
    updateUrl(searchParams, 'replace');
    promptCleared.current = true;
    setState((prev) => ({ ...prev, prompt: null }));
  }, [enabled, isReadOnly, params.prompt]);

  return {
    state,
    setThreadId,
    setAgentId,
    clearPrompt,
    isEnabled: enabled,
  };
}
