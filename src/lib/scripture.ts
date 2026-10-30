// Canonical names and common English abbreviations. Source references stay intact.
const BOOK_NAMES = [
  ["Genesis", "gen", "ge"], ["Exodus", "exod", "ex"], ["Leviticus", "lev"], ["Numbers", "num"], ["Deuteronomy", "deut"],
  ["Joshua", "josh"], ["Judges", "judg"], ["Ruth"], ["1 Samuel", "1 sam", "1sam"], ["2 Samuel", "2 sam", "2sam"],
  ["1 Kings", "1 kgs"], ["2 Kings", "2 kgs"], ["1 Chronicles", "1 chron"], ["2 Chronicles", "2 chron"], ["Ezra"], ["Nehemiah", "neh"],
  ["Esther", "esth"], ["Job"], ["Psalms", "psalm", "ps", "psa"], ["Proverbs", "prov"], ["Ecclesiastes", "eccl"], ["Song of Songs", "song of solomon"],
  ["Isaiah", "isa"], ["Jeremiah", "jer"], ["Lamentations", "lam"], ["Ezekiel", "ezek"], ["Daniel", "dan"], ["Hosea", "hos"], ["Joel"], ["Amos"],
  ["Obadiah", "obad"], ["Jonah"], ["Micah", "mic"], ["Nahum", "nah"], ["Habakkuk", "hab"], ["Zephaniah", "zeph"], ["Haggai", "hag"], ["Zechariah", "zech"], ["Malachi", "mal"],
  ["Matthew", "matt", "mt"], ["Mark", "mk"], ["Luke", "lk"], ["John", "jn"], ["Acts", "acts of the apostles"], ["Romans", "rom"],
  ["1 Corinthians", "1 cor", "1cor"], ["2 Corinthians", "2 cor", "2cor"], ["Galatians", "gal"], ["Ephesians", "eph"], ["Philippians", "phil"], ["Colossians", "col"],
  ["1 Thessalonians", "1 thess"], ["2 Thessalonians", "2 thess"], ["1 Timothy", "1 tim"], ["2 Timothy", "2 tim"], ["Titus"], ["Philemon", "phlm"], ["Hebrews", "heb"], ["James", "jas"],
  ["1 Peter", "1 pet", "1pet"], ["2 Peter", "2 pet", "2pet"], ["1 John", "1 jn", "1jn"], ["2 John", "2 jn", "2jn"], ["3 John", "3 jn", "3jn"], ["Jude"], ["Revelation", "rev", "apocalypse"],
  ["Tobit"], ["Judith"], ["Wisdom", "wisdom of solomon"], ["Sirach", "ecclesiasticus"], ["Baruch"], ["1 Maccabees", "1 macc"], ["2 Maccabees", "2 macc"], ["3 Maccabees", "3 macc"]
];
export const BIBLE_BOOKS = BOOK_NAMES.map(([label]) => ({ id: label.toLowerCase().replaceAll(" ", "-"), label }));
const aliases = new Map(BOOK_NAMES.flatMap((names, i) => names.map((name) => [name.toLowerCase(), BIBLE_BOOKS[i].id])));
const escaped = [...aliases.keys()].sort((a, b) => b.length - a.length).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replaceAll(" ", "\\s+"));
const pattern = `\\b(${escaped.join("|")})\\.?(?:\\s*(\\d{1,3})(?:\\s*:\\s*(\\d{1,3}))?(?:\\s*[-–—]\\s*(?:(\\d{1,3})\\s*:\\s*)?(\\d{1,3}))?)?\\b`;

export interface ScripturePassage { book: string; chapter?: number; lastChapter?: number; verse?: number; lastVerse?: number }

export function parseScripture(value: string | null | undefined, queryAliases = false): ScripturePassage[] {
  const text = value ?? "";
  const passages: ScripturePassage[] = [];
  for (const match of text.matchAll(new RegExp(pattern, "gi"))) {
    const book = aliases.get(match[1].toLowerCase().replace(/\s+/g, " "))!;
    // Don't mistake the trailing "John" in "1 John" for a separate Gospel.
    const chapter = match[2] ? Number(match[2]) : undefined;
    if (queryAliases && chapter === undefined) {
      const bookQuery = text.trim().replace(/^(?:sermons? (?:on|about)|(?:the )?(?:book|gospel|letter) (?:of|to))\s+/i, "").replace(/\.$/, "");
      if (bookQuery.toLowerCase() !== match[1].toLowerCase()) continue;
    }
    const verse = match[3] ? Number(match[3]) : undefined;
    const lastChapter = match[4] ? Number(match[4]) : verse === undefined && match[5] ? Number(match[5]) : chapter;
    const lastVerse = verse === undefined ? undefined : match[5] ? Number(match[5]) : verse;
    if (chapter === 0 || verse === 0 || (lastChapter !== undefined && chapter !== undefined && lastChapter < chapter)) continue;
    passages.push({ book, chapter, lastChapter, verse, lastVerse });
    // Numeric continuations inherit the book (and chapter for verse-only lists).
    let tail = text.slice((match.index ?? 0) + match[0].length);
    let previous = passages[passages.length - 1];
    const continuation = /^[;,]\s*(\d{1,3})(?::(\d{1,3}))?(?:\s*[-–—]\s*(?:(\d{1,3}):)?(\d{1,3}))?(?=$|[\s;,().])/;
    while (previous.chapter !== undefined) {
      const next = tail.match(continuation);
      if (!next) break;
      const explicitChapter = !!next[2];
      const nextChapter = explicitChapter || previous.verse === undefined ? Number(next[1]) : previous.chapter;
      const nextVerse = explicitChapter ? Number(next[2]) : previous.verse === undefined ? undefined : Number(next[1]);
      const nextLastChapter = next[3] ? Number(next[3]) : nextVerse === undefined && next[4] ? Number(next[4]) : nextChapter;
      const nextLastVerse = nextVerse === undefined ? undefined : next[4] ? Number(next[4]) : nextVerse;
      if (!nextChapter || nextVerse === 0 || nextLastChapter < nextChapter) break;
      previous = { book, chapter: nextChapter, lastChapter: nextLastChapter, verse: nextVerse, lastVerse: nextLastVerse };
      passages.push(previous);
      tail = tail.slice(next[0].length);
    }
  }
  if (queryAliases && /\bbeatitudes\b/i.test(text)) {
    passages.push({ book: "matthew", chapter: 5, lastChapter: 5, verse: 1, lastVerse: 12 }, { book: "luke", chapter: 6, lastChapter: 6, verse: 20, lastVerse: 26 });
  }
  return passages;
}

export function passagesOverlap(a: ScripturePassage, b: ScripturePassage): boolean {
  if (a.book !== b.book) return false;
  if (b.chapter === undefined) return true;
  if (a.chapter === undefined) return false; // A book-only allusion doesn't establish a chapter match.
  const aEnd = a.lastChapter ?? a.chapter;
  const bEnd = b.lastChapter ?? b.chapter;
  if (a.chapter > bEnd || b.chapter > aEnd) return false;
  const position = (chapter: number, verse: number) => chapter * 1000 + verse;
  return position(a.chapter, a.verse ?? 0) <= position(bEnd, b.lastVerse ?? 999)
    && position(b.chapter, b.verse ?? 0) <= position(aEnd, a.lastVerse ?? 999);
}
