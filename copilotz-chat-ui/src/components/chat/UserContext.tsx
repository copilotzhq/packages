import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ChatUserContext } from '../../types/chatTypes';

type Setter = (next: Partial<ChatUserContext> | ((prev: ChatUserContext) => Partial<ChatUserContext>)) => void;

interface ChatUserContextValue {
  context: ChatUserContext;
  setContext: Setter;
  resetContext: () => void;
}

const Ctx = createContext<ChatUserContextValue | undefined>(undefined);

export const ChatUserContextProvider: React.FC<{ children: React.ReactNode; initial?: Partial<ChatUserContext> }>
  = ({ children, initial }) => {
  const [ctx, setCtx] = useState<ChatUserContext>(() => ({
    updatedAt: Date.now(),
    ...(initial ?? {}),
  }));

  useEffect(() => {
    if (!initial) return;
    setCtx(prev => {
      const keys = Object.keys(initial) as (keyof typeof initial)[];
      const hasChanges = keys.some(k => prev[k] !== initial[k]);
      if (!hasChanges) return prev;
      return { ...prev, ...initial, updatedAt: Date.now() };
    });
  }, [initial]);

  const setPartial = useCallback<Setter>((next) => {
    setCtx(prev => {
      const partial = typeof next === 'function' ? next(prev) : next;
      return { ...prev, ...partial, updatedAt: Date.now() };
    });
  }, []);

  const value = useMemo<ChatUserContextValue>(() => ({
    context: ctx,
    setContext: setPartial,
    resetContext: () => setCtx({ updatedAt: Date.now() })
  }), [ctx, setPartial]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useChatUserContext(): ChatUserContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useChatUserContext must be used within ChatUserContextProvider');
  return v;
}
