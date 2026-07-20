export type ThreadIdentity = {
  id?: string | null;
  externalId?: string | null;
};

const identityValues = ({ id, externalId }: ThreadIdentity): string[] =>
  [id, externalId].filter((value): value is string => typeof value === 'string' && value.length > 0);

export const isSameThreadIdentity = (
  owner: ThreadIdentity,
  current: ThreadIdentity,
): boolean => {
  const ownerValues = identityValues(owner);
  if (ownerValues.length === 0) return true;

  const currentValues = new Set(identityValues(current));
  return ownerValues.some((value) => currentValues.has(value));
};
