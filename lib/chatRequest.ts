const MIB = 1024 * 1024;
const MAX_BINARY_SIZE = 15 * MIB;
const MAX_BODY_SIZE = 21 * MIB;

export class ChatRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function readChatRequest(request: Request): Promise<unknown> {
  const tooLarge = () => new ChatRequestError(413, "Ukuran total pesan dan lampiran terlalu besar.");
  if (Number(request.headers.get("content-length")) > MAX_BODY_SIZE) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new ChatRequestError(400, "Isi permintaan kosong.");
  const decoder = new TextDecoder();
  const parts = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_SIZE) {
        await reader.cancel().catch(() => {});
        throw tooLarge();
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(parts.join("") + decoder.decode());
  } catch {
    throw new ChatRequestError(400, "Format permintaan tidak valid.");
  }
}

export function validateChatAttachments(attachments: unknown) {
  if (!Array.isArray(attachments) || attachments.length > 3) return false;
  let total = 0;
  for (const media of attachments) {
    if (typeof media?.dataUrl !== "string" || typeof media?.mimeType !== "string" ||
        !["image", "video"].includes(media.type) ||
        !/^(image|video)\/[a-z0-9.+-]{1,32}$/i.test(media.mimeType) ||
        !media.mimeType.startsWith(media.type + "/")) return false;
    const prefix = "data:" + media.mimeType + ";base64,";
    if (!media.dataUrl.startsWith(prefix)) return false;
    const base64 = media.dataUrl.slice(prefix.length);
    if (!base64 || base64.length % 4 !== 0 || !/^[a-z0-9+/]+={0,2}$/i.test(base64)) return false;
    const bytes = base64.length * 3 / 4 - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
    if (bytes > (media.type === "image" ? 5 * MIB : MAX_BINARY_SIZE)) return false;
    total += bytes;
  }
  return total <= MAX_BINARY_SIZE;
}

let windowStarted = 0;
let totalCount = 0;
const counts = new Map<string, number>();

// The aggregate guest budget avoids trusting unverified forwarding headers.
export function useChatBudget(accountId: string | undefined, now = Date.now()): number | null {
  if (now - windowStarted >= 60_000) {
    windowStarted = now;
    totalCount = 0;
    counts.clear();
  }
  const key = accountId ? "account:" + accountId : "guests";
  const current = counts.get(key) ?? 0;
  if (totalCount >= 60 || current >= (accountId ? 16 : 24)) return Math.max(1, Math.ceil((windowStarted + 60_000 - now) / 1000));
  counts.set(key, current + 1);
  totalCount++;
  return null;
}
