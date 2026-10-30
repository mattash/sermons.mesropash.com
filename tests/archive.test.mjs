import test from "node:test";
import assert from "node:assert/strict";
import { archivePageUrl, PAGE_SIZE, paginate, searchSermons, sortSermons } from "../src/lib/archive.ts";

const sermon = (id, data = {}) => ({
  id: String(id),
  data: {
    sermonDate: "2026-01-01", title: `Sermon ${id}`, preacher: "Fr. Mesrop Ash",
    theme: null, scriptureReference: null, liturgicalDay: null, sermonType: null,
    tags: [], ...data
  }
});

test("archive pages cover every sermon once, including the final partial page", () => {
  const sermons = Array.from({ length: 98 }, (_, index) => sermon(index));
  const pages = Array.from({ length: 9 }, (_, index) => paginate(sermons, index + 1));
  assert.equal(pages[0].items.length, PAGE_SIZE);
  assert.deepEqual(pages.flatMap((page) => page.items), sermons);
  assert.deepEqual([pages[8].start, pages[8].end, pages[8].total, pages[8].items.length], [97, 98, 98, 2]);
});

test("empty archives and malformed search pages have bounded page numbers", () => {
  assert.deepEqual(paginate([]), { items: [], page: 1, totalPages: 1, total: 0, start: 0, end: 0 });
  const sermons = Array.from({ length: 13 }, (_, index) => sermon(index));
  for (const invalid of [0, -5, NaN, Infinity]) assert.equal(paginate(sermons, invalid).page, 1);
  assert.equal(paginate(sermons, 100).page, 2);
});

test("sort is stable for sermons sharing a date and leaves the source untouched", () => {
  const sermons = [sermon("b"), sermon("a"), sermon("c", { sermonDate: "2026-02-01" })];
  assert.deepEqual(sortSermons(sermons).map(({ id }) => id), ["c", "a", "b"]);
  assert.equal(sermons[0].id, "b");
});

test("search covers sermons beyond the current archive page and all existing metadata", () => {
  const sermons = Array.from({ length: 30 }, (_, index) => sermon(index));
  sermons[29].data = { ...sermons[29].data, title: "Forgiveness", tags: ["Repentance"], scriptureReference: "Luke 15", preacher: "Fr. Mésrop Ash" };
  assert.deepEqual(searchSermons(sermons, "FORGIVENESS mesrop Luke repentance"), [sermons[29]]);
  assert.deepEqual(searchSermons(sermons, "  "), sermons);
  assert.deepEqual(searchSermons(sermons, "unmatched"), []);
});

test("archive and search page links preserve queries safely", () => {
  assert.equal(archivePageUrl(1), "/");
  assert.equal(archivePageUrl(2), "/page/2/");
  assert.equal(archivePageUrl(1, "prayer & hope"), "/?q=prayer+%26+hope");
  assert.equal(archivePageUrl(3, "prayer"), "/?q=prayer&page=3");
});
