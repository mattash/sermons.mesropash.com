const SECTION_LABEL = /^\[(?:Armenian|English) sermon(?:\s+(?:continued|continues|partial transcript))?(?:\s*(?:—|–|-)\s*[^\]]+)?\]$/iu;
const UNRECOVERABLE_ARMENIAN_NOTE = /^\[(?:Note:\s*)?(?:(?:The\s+)?Armenian(?:-language)? sermon(?: portion)?.*(?:unintelligible|ASR|reconstruct)|The remainder of the Armenian sermon.*not reliably recoverable)[^\]]*\]$/iu;

/**
 * Remove archival navigation labels and editorial ASR disclaimers from public
 * copy. The underlying archive text remains untouched; Armenian prose itself
 * is retained whenever it is recoverable.
 */
export function publicSermonText(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Sermon text must be a non-empty string.");
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .split("\n")
    .filter((line) => !SECTION_LABEL.test(line.trim()) && !UNRECOVERABLE_ARMENIAN_NOTE.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function publicTopicTags(tags) {
  if (!Array.isArray(tags)) return [];

  return tags
    .filter((tag) => tag?.category === "theme" || tag?.category === "scripture")
    .map((tag) => (typeof tag.name === "string" ? tag.name.trim() : ""))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}
