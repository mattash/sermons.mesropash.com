export function tagSlug(tag: string): string {
  const readableSlug = tag
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  let hash = 0;
  for (let index = 0; index < tag.length; index += 1) {
    hash = (hash * 31 + tag.charCodeAt(index)) >>> 0;
  }

  return `${readableSlug || "topic"}-${hash.toString(36)}`;
}

export function tagUrl(tag: string): string {
  return `/topics/${tagSlug(tag)}/`;
}
