export function formatSermonDate(value: string): string {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(date);
}

export function videoStartUrl(url: string, startSeconds: number | null): string {
  if (!startSeconds || startSeconds <= 0) {
    return url;
  }

  const videoUrl = new URL(url);
  videoUrl.searchParams.set("t", String(Math.floor(startSeconds)));
  return videoUrl.toString();
}

