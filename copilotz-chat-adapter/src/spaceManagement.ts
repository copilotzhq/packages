import type {
  ChatCallbacks,
  ChatSpaceManagementRequest,
  ChatState,
  StateCallback
} from '@copilotz/chat-ui';

type SpaceManagementCallback = NonNullable<ChatCallbacks['onManageSpace']>;

export async function invokeSpaceManagement(
  callback: SpaceManagementCallback,
  request: ChatSpaceManagementRequest,
  stateCallback: StateCallback<ChatState> | undefined,
  refreshSpaces?: () => Promise<boolean> | undefined
): Promise<unknown> {
  const result = await callback(request, stateCallback);
  if (result === false) return false;
  if (!refreshSpaces) return result;
  return (await refreshSpaces()) === true;
}
