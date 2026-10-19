// Server-only Razorpay helpers. Test keys only; live keys are refused.
import { isTestKey } from "./fees";

export function razorpayConfig() {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) throw new Error("Payments are not configured yet");
  if (!isTestKey(keyId)) throw new Error("Only Razorpay TEST keys are allowed — live payments are disabled");
  return { keyId, keySecret };
}

const enc = new TextEncoder();
export async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function razorpayApi<T = Record<string, unknown>>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const { keyId, keySecret } = razorpayConfig();
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) {
    console.error("Razorpay API error", res.status, json?.error?.description);
    throw new Error("Payment provider request failed");
  }
  return json;
}
