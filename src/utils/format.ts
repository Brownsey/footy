export function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** Format a `[0, 1]` probability as a percentage string, e.g. `0.0731 → "7.3%"`. */
export function percent(probability: number, fractionDigits = 1): string {
  return `${(probability * 100).toFixed(fractionDigits)}%`;
}

export function dateSlug(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T00:00:00Z`));
}
