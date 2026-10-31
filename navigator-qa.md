# Sermon navigator verification — October 30, 2026

Story: a visitor opens a sermon, chooses a short key teaching from At a glance, and jumps to the matching source passage. Publishing generates the static menu from the transcript and verifies the proposed points with Clef.

| Boundary | Result | Evidence |
| --- | --- | --- |
| Source → outline | Passed | 98 current sermon records; 407 verified points, with three to five per sermon. |
| Outline → HTML | Passed | Every fragment destination exists and matches its source passage. All 98 rendered transcripts retain their full original text. |
| Browser → passage | Passed | 18 representative jumps across English and Armenian sermons and desktop/mobile layouts; URL fragments, focus, highlights, and direct-link reloads work. |
| Responsive menu | Passed | Right-hand sticky menu at 1440px; collapsible inline menu at 768px, 390px, and 320px; no horizontal overflow. |
| Static fallback | Passed | Links and expanded menu work without JavaScript. Browsing detail pages makes no inference requests. |
| Publishing fallback | Passed | Missing credentials preserve the existing artifact. Changed content suppresses stale menus until regenerated. |
| Code checks | Passed | 36 tests; Astro check reports zero errors and warnings; production build generates 1,074 pages. |

Desktop and phone screenshots were inspected. Browser checks found zero console errors. Checks caught and fixed an early active-point transition and the final-passage state at the bottom of a short page. Current-point tracking now agrees with source jumps and reading progress.
