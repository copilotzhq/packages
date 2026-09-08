export const number = (value: number | null) =>
  value === null
    ? "Not reported"
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
      value,
    );
export const compact = (value: number | null) =>
  value === null ? "Not reported" : new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
export const percent = (value: number | null) =>
  value === null ? "Not reported" : new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
export const duration = (value: number | null) =>
  value === null
    ? "Not reported"
    : value >= 1000
    ? `${number(value / 1000)} s`
    : `${number(value)} ms`;
export const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
