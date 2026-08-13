export async function textToField(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const firstHalf = new Uint8Array(digest).slice(0, 16);
  let value = BigInt(0);

  for (const byte of firstHalf) {
    value = value * BigInt(256) + BigInt(byte);
  }

  return `${value}field`;
}

export function shortId(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function getRecordPlaintext(record: unknown): string | null {
  if (typeof record === "string") return record;
  if (!record || typeof record !== "object") return null;

  const candidate = record as Record<string, unknown>;
  const directKeys = ["plaintext", "recordPlaintext", "record_plaintext"];
  for (const key of directKeys) {
    if (typeof candidate[key] === "string") return candidate[key] as string;
  }

  if (candidate.recordView && typeof candidate.recordView === "object") {
    const view = candidate.recordView as Record<string, unknown>;
    if (typeof view.plaintext === "string") return view.plaintext;
  }

  return null;
}
