export class ContractViolation extends Error {
  constructor(message: string) {
    super(message);
    Object.defineProperty(this, 'name', { value: 'ContractViolation' });
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const expectRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new ContractViolation(`${path} must be an object`);
  return value;
};

export const expectString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new ContractViolation(`${path} must be a non-empty string`);
  return value;
};

export const expectOptionalString = (value: unknown, path: string): string | undefined => {
  if (value === undefined || value === null) return undefined;
  return expectString(value, path);
};

export const expectStringValue = (value: unknown, path: string): string => {
  if (typeof value !== 'string') throw new ContractViolation(`${path} must be a string`);
  return value;
};
