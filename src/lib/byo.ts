// "Bring your own key", for a hosted demo: each visitor pastes their own Nuvion sandbox key and the server never holds one.
// It switches itself on when NUVION_API_KEY is not set. With the key in your environment (the normal way to run this
// starter) none of it runs, and you can delete this file, src/routes/api/key.ts and the key form in src/routes/index.tsx.
import { AsyncLocalStorage } from "node:async_hooks";
import { createHmac } from "node:crypto";

export const BASE_URL = process.env.NUVION_BASE_URL ?? "https://api.nuvion.dev";
export const byo = !process.env.NUVION_API_KEY;
export const COOKIE = "nv_key";

const secret = () => process.env.BETTER_AUTH_SECRET ?? "local-dev-only-secret";
const enc = new TextEncoder();
const aesKey = async () =>
  crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", enc.encode(secret())),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );

// The key lives only in the visitor's own cookie, sealed with AES-GCM so the browser holds ciphertext, not the key.
export async function seal(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await aesKey(),
    enc.encode(plain),
  );
  return `${Buffer.from(iv).toString("base64url")}.${Buffer.from(cipher).toString("base64url")}`;
}

/** The sealed value, or null if it is malformed, tampered with or sealed with another secret. */
export async function open(token: string): Promise<string | null> {
  try {
    const [iv, cipher] = token.split(".");
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(iv, "base64url") },
      await aesKey(),
      Buffer.from(cipher, "base64url"),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export const cookieOf = (headers: Headers) =>
  headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);

const visitor = new AsyncLocalStorage<{ key: string | null }>();

/** Runs a request with the visitor's key (from their cookie) available to the plugin's calls to Nuvion. */
export async function withVisitorKey<T>(
  headers: Headers,
  run: () => Promise<T>,
): Promise<T> {
  const token = cookieOf(headers);
  const key = byo && token ? await open(token) : null;
  return visitor.run({ key }, run);
}

/** The `fetch` handed to the plugin: it puts the visitor's own key on each call, and only ever talks to one host. */
export const visitorFetch: typeof fetch = async (input, init) => {
  if (!byo) return fetch(input, init);
  const key = visitor.getStore()?.key;
  if (!key) throw new Error("Add your Nuvion sandbox key first.");
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (url.origin !== new URL(BASE_URL).origin)
    throw new Error("Blocked a request to an unexpected host.");
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${key}`);
  return fetch(input, { ...init, headers });
};

/** The plugin needs a webhook secret even when no webhook is used. This one cannot be guessed, so nobody can forge an event. */
export const webhookSecret = () =>
  process.env.NUVION_WEBHOOK_SECRET ||
  createHmac("sha256", secret()).update("unused-webhook").digest("hex");

/** The kind of key this demo takes: a sandbox key with the Operations role. Returns what is wrong, or null if it is fine. */
export async function checkKey(key: string): Promise<string | null> {
  if (new URL(BASE_URL).hostname !== "api.nuvion.dev")
    return "Visitors' keys are only taken for the Nuvion sandbox. Check NUVION_BASE_URL.";
  if (!/^[\w-]{20,200}$/.test(key))
    return "That does not look like a Nuvion API key.";
  const status = async (path: string) =>
    (
      await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${key}` },
      })
    ).status;
  const [details, entities] = await Promise.all([
    status("/account-details?limit=1"),
    status("/entities?limit=1"),
  ]);
  if (details === 401 || entities === 401)
    return "The Nuvion sandbox does not accept that key. Create it in the sandbox dashboard, not the production one.";
  if (entities === 200)
    return "That key is too powerful: it is an Owner or Admin key. Create a new one with the Operations role.";
  if (details !== 200)
    return "That key cannot take payments. Create a new one with the Operations role (a Developer key is read-only).";
  return null;
}
