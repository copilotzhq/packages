---
name: packages
kind: lib
summary: Shared React chat UI, Copilotz adapter, and admin packages used by client web apps.
depends_on:
  - copilotz
tags:
  - frontend
  - react
  - ui
  - adapter
  - streaming
entrypoints:
  - copilotz-chat-ui/src/index.ts
  - copilotz-chat-ui/src/components/chat/ChatUI.tsx
  - copilotz-chat-adapter/src/CopilotzChat.tsx
  - copilotz-chat-adapter/src/useCopilotzChat.ts
  - copilotz-admin/src/index.ts
  - copilotz-admin/src/core/CopilotzAdmin.tsx
status: active
---

## Purpose

Shared npm packages for Copilotz web experiences: `@copilotz/chat-ui` provides the reusable React chat UI layer, `@copilotz/chat-adapter` binds that UI to Copilotz backend APIs, SSE streaming, threads, tools, assets, and user context, and `@copilotz/admin` provides the reusable admin shell and default Copilotz admin modules.

## Read These First

- `copilotz-chat-ui/src/index.ts`
- `copilotz-chat-ui/src/components/chat/ChatUI.tsx`
- `copilotz-chat-ui/src/components/chat/ChatInput.tsx`
- `copilotz-chat-adapter/src/CopilotzChat.tsx`
- `copilotz-chat-adapter/src/useCopilotzChat.ts`
- `copilotz-chat-adapter/src/copilotzService.ts`
- `copilotz-admin/src/index.ts`
- `copilotz-admin/src/core/CopilotzAdmin.tsx`
- `copilotz-admin/src/modules/index.ts`

## Common Task Locations

- Shared presentational chat components: `copilotz-chat-ui/src/components/chat/`
- UI types and configuration: `copilotz-chat-ui/src/types/`, `copilotz-chat-ui/src/config/`
- Copilotz API integration and SSE parsing: `copilotz-chat-adapter/src/copilotzService.ts`
- Chat state, optimistic updates, and thread sync: `copilotz-chat-adapter/src/useCopilotzChat.ts`
- Asset resolution and special adapter states: `copilotz-chat-adapter/src/assetsService.ts`, `copilotz-chat-adapter/src/specialState.ts`
- Admin shell and extension model: `copilotz-admin/src/core/`
- Admin API client and DTOs: `copilotz-admin/src/api/`
- Built-in admin modules: `copilotz-admin/src/modules/`
- Reusable admin UI patterns: `copilotz-admin/src/components/patterns/`

## Warnings

- Clients usually consume published npm versions of these packages, not the local workspace copy.
- `chat-ui` is backend-agnostic, but `chat-adapter` assumes Copilotz HTTP endpoints and SSE event shapes.
- Audio input already exists here as recorded/file attachments, so voice features should avoid duplicating that path unless the UX meaningfully changes.
