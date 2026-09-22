import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChatSpace,
  ChatSpaceMember,
  ChatSpaceViewData,
  ChatThread,
  SpaceCollection
} from '@copilotz/chat-ui';
import type {
  ChatSpaceService,
  SpaceCollectionPage,
  SpaceUpdate
} from './controller';

export type SpaceViewService = Pick<
  ChatSpaceService,
  'get' | 'update' | 'conversations' | 'members' | 'addMember' | 'removeMember'
>;

export interface UseSpaceViewOptions {
  service?: SpaceViewService;
  spaceId: string | null;
  /** Already loaded sidebar record used while detail data is loading. */
  initialSpace?: ChatSpace;
}

export interface SpaceViewState {
  space: ChatSpace | undefined;
  data: ChatSpaceViewData;
  isLoading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  updateSpace: (patch: SpaceUpdate) => Promise<ChatSpace>;
  addMember: (memberId: string) => Promise<ChatSpaceMember>;
  removeMember: (memberId: string) => Promise<void>;
}

type CollectionKey = 'conversations' | 'members';

const normalize = <T>(
  value: SpaceCollectionPage<T> | readonly T[],
): SpaceCollection<T> => {
  const page = Array.isArray(value)
    ? { items: value as readonly T[] }
    : value as SpaceCollectionPage<T>;
  const items = page.items ?? [];
  return {
    status: items.length === 0 ? 'empty' : page.hasMore ? 'partial' : 'ready',
    items,
    hasMore: page.hasMore,
    next: page.next,
  };
};

/**
 * Loads the optional native Space sources once and cancels stale selection
 * work. It is intentionally a thin adapter around the host service: no URL,
 * HTTP or endpoint defaults are introduced here.
 */
export function useSpaceView({
  service,
  spaceId,
  initialSpace,
}: UseSpaceViewOptions): SpaceViewState {
  const [space, setSpace] = useState<ChatSpace | undefined>(
    service?.get && initialSpace
      ? { ...initialSpace, permissions: undefined }
      : undefined,
  );
  const [data, setData] = useState<ChatSpaceViewData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [source, setSource] = useState({ spaceId, service });
  const generation = useRef(0);
  const controllers = useRef(new Map<string, AbortController>());
  const initialSpaceRef = useRef(initialSpace);
  initialSpaceRef.current = initialSpace;

  const begin = useCallback((key: string) => {
    controllers.current.get(key)?.abort();
    const controller = new AbortController();
    controllers.current.set(key, controller);
    return controller;
  }, []);

  const loadCollection = useCallback(async (
    key: CollectionKey,
    id: string,
    currentGeneration: number,
    cursor?: string,
    append = false,
  ) => {
    const method = key === 'conversations' ? service?.conversations : service?.members;
    if (!method) return;
    const controller = begin(key);
    try {
      const result = await method(id, { signal: controller.signal, cursor });
      if (generation.current !== currentGeneration || controller.signal.aborted) return;
      const page = key === 'conversations'
        ? normalize<ChatThread>(result as SpaceCollectionPage<ChatThread> | readonly ChatThread[])
        : normalize<ChatSpaceMember>(result as SpaceCollectionPage<ChatSpaceMember> | readonly ChatSpaceMember[]);
      setData((current: ChatSpaceViewData) => {
        const prior = append ? (current[key]?.items ?? []) : [];
        const items = [...prior, ...(page.items ?? [])];
        const collection = {
          ...page,
          items,
          onLoadMore: page.hasMore && page.next
            ? () => loadCollection(key, id, currentGeneration, page.next, true)
            : undefined,
        };
        return key === 'conversations'
          ? { ...current, conversations: collection as SpaceCollection<ChatThread> }
          : { ...current, members: collection as SpaceCollection<ChatSpaceMember> };
      });
    } catch (cause) {
      if (generation.current !== currentGeneration || controller.signal.aborted) return;
      const failed: SpaceCollection<ChatThread | ChatSpaceMember> = {
        status: 'error',
        error: cause instanceof Error ? cause.message : `Unable to load ${key}.`,
      };
      setData((current: ChatSpaceViewData) => key === 'conversations'
        ? { ...current, conversations: failed as SpaceCollection<ChatThread> }
        : { ...current, members: failed as SpaceCollection<ChatSpaceMember> });
    }
  }, [begin, service]);

  const refresh = useCallback(async () => {
    const id = spaceId;
    const currentGeneration = ++generation.current;
    setSource({ spaceId: id, service });
    for (const controller of controllers.current.values()) controller.abort();
    controllers.current.clear();
    if (!id) {
      setSpace(undefined);
      setData({});
      setIsLoading(false);
      setError(null);
      return;
    }
    const fallbackSpace = initialSpaceRef.current;
    setSpace(
      service?.get && fallbackSpace
        ? { ...fallbackSpace, permissions: undefined }
        : undefined,
    );
    setData({
      ...(service?.conversations ? { conversations: { status: 'loading' as const } } : {}),
      ...(service?.members ? { members: { status: 'loading' as const } } : {}),
    });
    setIsLoading(Boolean(service?.get || service?.conversations || service?.members));
    setError(null);

    const detailController = service?.get ? begin('detail') : undefined;
    const detailPromise = service?.get && detailController
      ? service.get(id, { signal: detailController.signal })
          .then((result) => {
            if (generation.current === currentGeneration && !detailController.signal.aborted) setSpace(result);
          })
          .catch((cause) => {
            if (generation.current === currentGeneration && !detailController.signal.aborted) {
              setSpace(undefined);
              setError((current: unknown) => current ?? cause);
            }
          })
      : Promise.resolve();
    const collectionPromises = [
      service?.conversations ? loadCollection('conversations', id, currentGeneration) : Promise.resolve(),
      service?.members ? loadCollection('members', id, currentGeneration) : Promise.resolve(),
    ];
    await Promise.allSettled([detailPromise, ...collectionPromises]);
    if (generation.current === currentGeneration) setIsLoading(false);
  }, [begin, loadCollection, service, spaceId]);

  useEffect(() => {
    void refresh();
    return () => {
      for (const controller of controllers.current.values()) controller.abort();
      controllers.current.clear();
      generation.current++;
    };
  }, [refresh]);

  const updateSpace = useCallback(async (patch: SpaceUpdate) => {
    if (!spaceId || !service?.update) throw new Error('Space updates are unavailable.');
    const currentGeneration = generation.current;
    const controller = begin('update');
    setIsLoading(false);
    try {
      const updated = await service.update(spaceId, patch, { signal: controller.signal });
      if (generation.current !== currentGeneration || controller.signal.aborted) {
        throw new Error('The Space selection changed before the update completed.');
      }
      setSpace(updated);
      return updated;
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause);
      throw cause;
    }
  }, [begin, service, spaceId]);

  const addMember = useCallback(async (memberId: string) => {
    if (!spaceId || !service?.addMember) throw new Error('Adding Space members is unavailable.');
    const currentGeneration = generation.current;
    const controller = begin('member-mutation');
    const result = await service.addMember(spaceId, { id: memberId }, { signal: controller.signal });
    if (generation.current !== currentGeneration || controller.signal.aborted) {
      throw new Error('The Space selection changed before the member was added.');
    }
    await refresh();
    return result;
  }, [begin, refresh, service, spaceId]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!spaceId || !service?.removeMember) throw new Error('Removing Space members is unavailable.');
    const currentGeneration = generation.current;
    const controller = begin('member-mutation');
    const result = await service.removeMember(spaceId, memberId, { signal: controller.signal });
    if (result === false) throw new Error('The Space member could not be removed.');
    if (generation.current !== currentGeneration || controller.signal.aborted) {
      throw new Error('The Space selection changed before the member was removed.');
    }
    await refresh();
  }, [begin, refresh, service, spaceId]);

  const isCurrentSelection = source.spaceId === spaceId && source.service === service;
  const visibleSpace = isCurrentSelection
    ? service?.get ? space : space ?? initialSpace
    : service?.get && initialSpace
      ? { ...initialSpace, permissions: undefined }
      : initialSpace;
  const visibleData = isCurrentSelection ? data : {};
  const visibleLoading = isCurrentSelection
    ? isLoading
    : Boolean(spaceId && (service?.get || service?.conversations || service?.members));
  const visibleError = isCurrentSelection ? error : null;

  return useMemo(
    () => ({
      space: visibleSpace,
      data: visibleData,
      isLoading: visibleLoading,
      error: visibleError,
      refresh,
      updateSpace,
      addMember,
      removeMember,
    }),
    [visibleSpace, visibleData, visibleLoading, visibleError, refresh, updateSpace, addMember, removeMember],
  );
}
