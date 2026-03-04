import type { ReactNode } from 'react';

export type SpecialChatState = {
  kind: string;
  title?: string;
  message?: string;
  payload?: Record<string, unknown>;
};

export type SpecialStateControls = {
  clear: () => void;
};

export type RenderSpecialState = (
  state: SpecialChatState,
  controls: SpecialStateControls,
) => ReactNode | null;

export type EventInterceptorResult =
  | void
  | {
      handled?: boolean;
      specialState?: SpecialChatState | null;
    };

export type EventInterceptor = (event: unknown) => EventInterceptorResult;
export type RunErrorInterceptor = (error: unknown) => SpecialChatState | null | undefined;
