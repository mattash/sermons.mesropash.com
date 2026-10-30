import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

export const CLEF_MODEL = "@cf/cloudflare/clef";

export async function createClefClient(credentialFile) {
  // Consume only the Cloudflare fields. Never copy the mounted Environment into
  // process.env, a child process, logs, or an artifact.
  const values = credentialFile ? parseEnv(await readFile(credentialFile, "utf8")) : process.env;
  const token = values.CLOUDFLARE_WORKERSAI_API_KEY;
  const account = values.CLOUDFLARE_WORKERSAI_ACCOUNT_ID;
  if (!token || !account) throw new Error("Cloudflare Workers AI credential variables are missing.");
  if (!/^[a-f0-9]{32}$/i.test(account)) throw new Error("Invalid Cloudflare account ID.");
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${CLEF_MODEL}`;

  return async (state, questions) => {
    const body = JSON.stringify({ model: "clef", state, questions });
    // Conservatively fit the 65,536-token context, including all questions.
    // Refuse oversized inputs instead of letting the provider truncate a sermon.
    if (Buffer.byteLength(body) > 60_000) throw new Error("Clef input exceeds the archive's safe context budget.");
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(endpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(60_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }
      if (!response.ok) throw new Error(`Cloudflare Clef request failed (HTTP ${response.status}).`);
      const envelope = await response.json();
      if (envelope.success === false) throw new Error("Cloudflare Clef reported an unsuccessful request.");
      const result = envelope.result ?? envelope;
      if (!result.answers || typeof result.answers !== "object") throw new Error("Clef returned no structured answers.");
      return result;
    }
    throw new Error("Cloudflare Clef request exhausted its retry budget.");
  };
}
