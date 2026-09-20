import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false;
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyLemonSqueezySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature.trim());
}

export function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowMs = Date.now(),
  toleranceSeconds = 5,
) {
  if (!signatureHeader) return false;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(";")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "ts" && /^\d+$/.test(value ?? "")) timestamp = Number(value);
    if (key === "h1" && value) signatures.push(value);
  }
  if (
    timestamp === null ||
    !Number.isSafeInteger(timestamp) ||
    Math.abs(Math.floor(nowMs / 1_000) - timestamp) > toleranceSeconds ||
    signatures.length === 0
  ) return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}:${rawBody}`)
    .digest("hex");
  return signatures.some((signature) => safeEqualHex(expected, signature));
}
