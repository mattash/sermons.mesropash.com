import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentDirectory = path.join(projectRoot, "src", "content", "sermons");
const apiUrl = process.env.SERMON_ARCHIVE_API_URL ?? "https://sermon-archive.mesropash.com/api/v1/sermons";
const checkOnly = process.argv.includes("--check");

function requiredString(value, field, sermonId) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Sermon ${sermonId} has no usable ${field}.`);
  }
  return value.trim();
}

function optionalString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function optionalNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function yaml(value) {
  return JSON.stringify(value);
}

function fileSlug(value) {
  const normalized = String(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 88);
  return normalized || "sermon";
}

function fileName(sermon) {
  const date = optionalString(sermon.sermonDate) ?? optionalString(sermon.sourceVideo?.date) ?? "undated";
  return `${date}-${sermon.id}-${fileSlug(sermon.title)}.md`;
}

function safeMarkdownText(value) {
  return requiredString(value, "text", "unknown")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim();
}

function markdownFor(sermon) {
  const id = Number(sermon.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Public API returned an invalid sermon id: ${sermon.id}`);
  }

  const sourceVideo = sermon.sourceVideo ?? {};
  const tags = Array.isArray(sermon.tags)
    ? sermon.tags.map((tag) => optionalString(tag?.name)).filter(Boolean).sort((a, b) => a.localeCompare(b))
    : [];
  const frontmatter = [
    "---",
    `archiveId: ${id}`,
    `sermonDate: ${yaml(optionalString(sermon.sermonDate) ?? optionalString(sourceVideo.date) ?? "Date unavailable")}`,
    `title: ${yaml(requiredString(sermon.title, "title", id))}`,
    `preacher: ${yaml(optionalString(sermon.preacher) ?? "Unknown preacher")}`,
    `language: ${yaml(optionalString(sermon.language) ?? "Unknown")}`,
    `theme: ${yaml(optionalString(sermon.theme))}`,
    `scriptureReference: ${yaml(optionalString(sermon.scriptureReference))}`,
    `liturgicalDay: ${yaml(optionalString(sermon.liturgicalDay))}`,
    `sermonType: ${yaml(optionalString(sermon.sermonType))}`,
    `startSeconds: ${yaml(optionalNumber(sermon.startSeconds))}`,
    `endSeconds: ${yaml(optionalNumber(sermon.endSeconds))}`,
    `sourceVideoId: ${yaml(requiredString(sourceVideo.id, "source video id", id))}`,
    `sourceVideoUrl: ${yaml(requiredString(sourceVideo.url, "source video URL", id))}`,
    `sourceVideoTitle: ${yaml(requiredString(sourceVideo.title, "source video title", id))}`,
    "tags:"
  ];

  if (tags.length === 0) {
    frontmatter.push("  []");
  } else {
    frontmatter.push(...tags.map((tag) => `  - ${yaml(tag)}`));
  }

  frontmatter.push("---", "");
  return `${frontmatter.join("\n")}${safeMarkdownText(sermon.text)}\n`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "sermons-mesropash-sync/1.0" }
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  const index = await fetchJson(apiUrl);
  if (index.schemaVersion !== "1.0" || !Array.isArray(index.sermons)) {
    throw new Error("The sermon API returned an unsupported index schema.");
  }

  const origin = new URL(apiUrl).origin;
  const details = await mapWithConcurrency(index.sermons, 6, async (summary) => {
    const id = Number(summary.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`Invalid sermon id in index: ${summary.id}`);
    }
    const detailUrl = new URL(summary.href ?? `/api/v1/sermons/${id}`, origin);
    const detail = await fetchJson(detailUrl);
    if (detail.schemaVersion !== "1.0" || !detail.sermon || Number(detail.sermon.id) !== id) {
      throw new Error(`The sermon detail response for ${id} does not match the index.`);
    }
    return detail.sermon;
  });

  const expected = new Map();
  for (const sermon of details) {
    const target = fileName(sermon);
    if (expected.has(target)) {
      throw new Error(`Two sermons resolve to the same Markdown filename: ${target}`);
    }
    expected.set(target, markdownFor(sermon));
  }

  await mkdir(contentDirectory, { recursive: true });
  const existing = new Set((await readdir(contentDirectory)).filter((name) => name.endsWith(".md")));
  const changes = [];

  for (const [name, content] of expected) {
    const target = path.join(contentDirectory, name);
    let current = null;
    try {
      current = await readFile(target, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (current !== content) {
      changes.push(name);
      if (!checkOnly) {
        await writeFile(target, content, "utf8");
      }
    }
    existing.delete(name);
  }

  for (const obsolete of existing) {
    changes.push(obsolete);
    if (!checkOnly) {
      await rm(path.join(contentDirectory, obsolete));
    }
  }

  if (checkOnly && changes.length > 0) {
    throw new Error(`${changes.length} sermon Markdown file(s) are out of sync.`);
  }

  console.log(JSON.stringify({ apiUrl, changed: changes.length, sermons: details.length }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

