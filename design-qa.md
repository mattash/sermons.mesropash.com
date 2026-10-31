# Sermon archive design QA

Date: 2026-10-30

## Target and evidence

- Source visual: .cache/design-qa/reference.png (approved navbar-only pine variant).
- Implementation: local Astro preview at http://127.0.0.1:4321/
- Final desktop screenshot: .cache/design-qa/desktop-final.png
- Full-view comparison: .cache/design-qa/comparison-final.png, source left and implementation right.
- Focused comparisons: .cache/design-qa/header-comparison-final.png and rows-comparison-final.png
- Responsive evidence: .cache/design-qa/width-768.png, width-390.png, width-320.png, and filters-mobile.png
- Evidence images are retained locally in the ignored cache directory.
- Source and desktop capture: 1546 × 1017 pixels; CSS viewport 1546 × 1017; deviceScaleFactor 1. No scaling or browser frame.
- Phone/tablet CSS viewports: 320 × 844, 390 × 844, 768 × 844; deviceScaleFactor 1.
- Default state: newest first, filters closed; additional captures show filters and search results.
- Browser: isolated Chrome driven by Playwright, explicitly authorized after the in-app browser reported disabled.

## Findings and comparison history

1. [P2, resolved] Real-data summaries initially made the rows taller than the target.
   Evidence: comparison-initial.png; four complete rows did not fit.
   Fix: compact date-column grid, one-line desktop summary previews and 16px row padding.
   Post-fix: comparison-final.png and rows-comparison-final.png. First row y=390.58; fourth row ends at y=988.08 within the 1017px viewport.

2. [P2, resolved] Small toolbar-spacing differences, undersized shortcuts and vertical slider icon.
   Evidence: header-comparison-initial.png.
   Fix: 66px navbar, adjusted title/search spacing, 16px shortcut text and a rotated library icon.
   Post-fix: header-comparison-final.png. Content width 1088px within a 1152px shell.

3. [P2, resolved] Wrapped phone topics consumed too much of the first screen.
   Initial capture placed the first sermon below y=640.
   Fix: keyboard-accessible scrolling topic strip with All topics kept visible; omit redundant count on narrowest phones.
   Post-fix: width-390.png and width-320.png. First sermon y=490.70; no page overflow, including expanded filters. Keyboard focus scrolls the last topic into view.

4. [P2, resolved] Placeholder contrast was 3.73:1.
   Fix: placeholder #68776f, now 4.71:1 against white.
   Other checked contrast: navbar text 8.85:1; dates 4.53:1; muted text 4.97:1.

No actionable P0/P1/P2 findings remain.

## Required fidelity surfaces

- Typography: Georgia serif identity; reference hierarchy for brand, title, compact metadata and sermon titles. Real long titles wrap naturally.
- Spacing/layout: pine navbar only, ivory title area, aligned Search/Filters, one shortcut strip, fine ruled rows and centered pagination. Desktop and mobile controls remain usable.
- Colors/tokens: pine #214f46, ivory #fbfaf6, antique gold, pale green labels, fine gray dividers. Date gold is intentionally darker for readable contrast.
- Assets/icons: no photographs or illustrations in the reference. Search, filter and chevron use MIT-licensed Feather icon data, inspected in the browser; no handcrafted icon paths or image substitutes.
- Copy/content: interface follows the mockup. Actual titles, dates, preachers, Scripture and canonical topic assignments remain authoritative. Summaries are source-preserving previews; sermon source text was not edited.

Expected differences: the mock illustrates four selected entries with example copy. Production retains all 98 published sermons, 12 per page, the actual third entry and real metadata. Four real entries fit the reference desktop viewport. Phone layout adapts to its smaller viewport.

## Verification

- 31 automated tests passed; Astro check: 0 errors and 0 warnings (existing deprecation hints only); static build passed.
- DOM checks: lazy loading, safe excerpts, fallback/retry, combined filters, chapter controls, clearing, URL restoration, pagination, caching and stale-response cancellation.
- Browser checks: sorting before pagination; sort preserved in links; Scripture/chapter/year filters; count badge; Escape closes filters and restores focus; restored URLs; Scripture search; empty state.
- Real Clef search through a local test proxy to the existing production endpoint returned four results. Excerpts and links rendered correctly. Sorting reused results without another provider request.
- Responsive layouts and expanded filters passed at 1546, 768, 390 and 320px.
- Final rendered states: zero JavaScript exceptions and zero console errors.
- Source and final implementation were compared together at full view and in combined header/row crops.

## Implementation checklist

- [x] Pine navbar; ivory title area.
- [x] Compact Search/Filters and topics.
- [x] Real sermon rows, previews and topic links.
- [x] Functional sorting and pagination.
- [x] Desktop/tablet/phone visual and interaction checks.
- [x] Build and automated checks.

Final result: passed
