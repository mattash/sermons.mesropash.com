import test from "node:test";
import assert from "node:assert/strict";

import { publicSermonText, publicTopicTags } from "../scripts/sermon-content.mjs";

test("keeps recoverable Armenian but strips labels and ASR editorial notes", () => {
  const text = publicSermonText(`
[Armenian sermon]

Քրիստոս ի մէջ մեր յայտնեցաւ։

[Note: The Armenian-language sermon portion is largely unintelligible in the transcript due to severe ASR errors.]

[English sermon]

Christ is risen.
`);

  assert.equal(text, "Քրիստոս ի մէջ մեր յայտնեցաւ։\n\nChrist is risen.");
});

test("removes legacy section-label variants", () => {
  assert.equal(
    publicSermonText("[English sermon — children's homily]\n\nA homily.\n\n[Armenian sermon continued]\n\nՇարունակություն։"),
    "A homily.\n\nՇարունակություն։"
  );
});

test("publishes only sermon topics and scripture tags", () => {
  assert.deepEqual(
    publicTopicTags([
      { category: "person", name: "A parishioner" },
      { category: "theme", name: "Resurrection" },
      { category: "place", name: "San Francisco" },
      { category: "scripture", name: "John 11" }
    ]),
    ["John 11", "Resurrection"]
  );
});
