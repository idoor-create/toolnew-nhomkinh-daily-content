export function toIsoUtc(localValue: string) {
  return new Date(localValue).toISOString();
}

export function toDatetimeLocal(iso: string | null | undefined) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseMediaUrls(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
