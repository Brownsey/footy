# Build Brief — 2026 FIFA World Cup Predictions App

## 0. Purpose

A polished single-page web app that lets a user predict the entire 2026 FIFA World Cup: pick group-stage results, watch the knockout bracket populate from those picks, choose a champion, save/resume via file, and consult AI-generated prediction sets ("Claude Predicts") for inspiration. Professional UX is a first-class requirement, not a finishing touch.


You should always followed hexagonal architecture when implementing python code. Otherwise focus on clean reusable code, broken down cleanly and professional. Where possible avoid bloat and re-use code wherever possible.

You must use UV to handle all python files and packaging.

It should be runnable both locally and hosted via vercel if required. For local hosting there should be a run.bat file which can be clicked to load everything required to display the page.
---

## 1. Ground truth: the real 2026 tournament

This is the single most important section. The tournament structure changed this cycle — do **not** model it as a 32-team / 8-group event from memory.

### Format (confirmed)
- **48 teams**, hosted by USA, Canada, Mexico, 11 June – 19 July 2026.
- **12 groups of four**, labelled A–L. Each team plays 3 group games.
- **Advancement:** top 2 of each group (24 teams) **plus the 8 best third-placed teams** advance to a new **Round of 32**.
- Knockout rounds: Round of 32 → Round of 16 → Quarter-finals → Semi-finals → Final (no third-place playoff handling required unless you choose to add it; the real tournament has one).
- 104 matches total.
- FIFA created **two separate bracket pathways** to keep the strongest seeds apart until the semis (e.g. Spain and Argentina are deliberately on opposite sides). The knockout bracket wiring must respect the official R32 pairing map — see §3.

### The "best third-placed teams" rule — implementation-critical
This is the hardest part of the model and the part most likely to be done wrong. After the group stage:
1. Rank all 12 third-placed teams by points → goal difference → goals scored (→ further FIFA tiebreakers).
2. The top 8 of those 12 advance.
3. **Which group's third-place team goes into which R32 slot is determined by a fixed FIFA allocation table keyed on *which combination of groups* the 8 qualifiers come from.** There are a finite number of combinations, each with a predefined mapping. You must implement this lookup table — you cannot improvise the bracket wiring for third-placed teams. Source it from the official FIFA regulations for the 2026 R32.

### The draw (all 12 groups, playoff slots resolved)

| Group | Team 1 | Team 2 | Team 3 | Team 4 |
|-------|--------|--------|--------|--------|
| A | Mexico (host) | South Africa | South Korea | Czechia |
| B | Canada (host) | Bosnia & Herzegovina | Qatar | Switzerland |
| C | Brazil | Morocco | Haiti | Scotland |
| D | United States (host) | Paraguay | Australia | Türkiye |
| E | Germany | Curaçao | Ivory Coast | Ecuador |
| F | Netherlands | Japan | Sweden | Tunisia |
| G | Belgium | Egypt | Iran | New Zealand |
| H | Spain | Cape Verde | Saudi Arabia | Uruguay |
| I | France | Senegal | Iraq | Norway |
| J | Argentina | Algeria | Austria | Jordan |
| K | Portugal | DR Congo | Uzbekistan | Colombia |
| L | England | Croatia | Ghana | Panama |

Playoff-slot resolutions (in case the data source still shows placeholders): UEFA Path A → Bosnia & Herzegovina; Path B → Sweden; Path C → Türkiye; Path D → Czechia; Inter-confederation Pathway 1 → DR Congo; Pathway 2 → Iraq.

Tournament debutants (nice for "insight" copy): Cape Verde, Curaçao, Jordan, Uzbekistan. Defending champions: Argentina. Joint pre-tournament favourites: Spain and France, then England, Brazil, Argentina.

> Build note: store this draw as seed data in a single `tournament.json`, with a `lastVerified` date. The group stage is decided by points, not by "pick one winner per match" — see §2.

---

## 2. Core interaction model

### Group stage (this is NOT a knockout pick)
Because groups are mini round-robins, the UI must let the user predict **each of the 6 matches per group** (W/D/L or a scoreline), then compute the table (3/1/0 points, GD, goals) and derive the group's 1st, 2nd, and 3rd automatically. Picking "the group winner" directly is the wrong mental model and breaks the third-place logic. Reasonable simplification for v1: let users pick **outcome per match (Home win / Draw / Away win)** rather than full scorelines, but allow optional scoreline entry because GD is needed to rank third-placed teams. If you only capture W/D/L you cannot rank thirds — so either require scorelines, or generate plausible GD, or provide a manual tiebreak prompt. State the choice explicitly in the UI.

### Bracket stage (this IS drag-and-drop / pick-a-winner)
- Once all group results are entered, compute the 24 group qualifiers + 8 best thirds, then populate the Round of 32 using the official slot map (§1, §3).
- From R32 onward it's single-elimination: the user picks a winner per tie (drag-and-drop the winner forward, or click). Each pick cascades to populate the next round's fixture.
- Final pick = champion, with a celebratory but tasteful moment.

### Cascade behaviour
- Changing an earlier pick must invalidate and visually flag (not silently wipe) downstream picks that depended on it. Offer "re-apply where still valid / clear affected." Never lose the user's whole bracket because they changed one group game.

---

## 3. Knockout bracket wiring

Implement the **official R32 → R16 → QF → SF → Final** progression map from FIFA's 2026 bracket, including the two-pathway separation. Hardcode this as a data structure (slot IDs, not team names), e.g. `R32_M1 = winner(Group A) vs 3rd(B/E/F/I/...)`. Do not infer it. The bracket is asymmetric because of the third-place allocations, so a naive "1A vs 2B" mirror won't match the real tournament.

---

## 4. Persistence: save / resume / share

- **Export:** the user's full prediction state downloadable as both **JSON** (canonical, round-trippable) and **CSV** (human-readable / spreadsheet-friendly — flatten to one row per match with columns: stage, group, matchId, home, away, pick, scoreline, timestamp).
- **Import:** upload a previously exported JSON to restore exact state. CSV import is optional (JSON is the source of truth).
- **JSON is the save format.** Treat the file round-trip as the persistence layer — do not rely on `localStorage`/`sessionStorage` (unreliable/blocked in several sandboxes and in Claude artifacts). If running outside such constraints, you *may* add localStorage as a convenience autosave, but the file export must remain the authoritative save mechanism.
- Version the schema (`schemaVersion`) so future changes can migrate old saves.

---

## 5. Team & match insight (research layer)

Reframed from the original "research every possible match" (combinatorially impossible with 48 teams) to **research every team once, synthesise matchups on demand**:

- Build a local `teams.json` profile for each of the 48 teams: FIFA ranking, recent form, qualification route, key players, historical World Cup pedigree, notable strengths/weaknesses, one-line narrative. Populate this via research and **cache it locally** — no live calls needed at pick time.
- When a specific matchup becomes relevant, **compute** the head-to-head insight from the two stored profiles (ranking delta, form, history, "what to expect"). This gives the per-match insight UX without precomputing an infinite space.
- Mark each profile with a `lastVerified` date and a `confidence` flag. Squads firm up around 2 June 2026, so allow a refresh path.

---

## 6. Probability / plausibility engine (define this explicitly — original brief left it undefined)

Several features depend on a probability number, so pick one consistent engine and document it:

- **Recommended v1:** an Elo-style or FIFA-ranking-delta model that converts the rating gap between two teams into a win/draw/loss probability. Deterministic, explainable, no external odds dependency.
- **Optional enhancement:** blend in bookmaker-implied probabilities if you ingest an odds source (cite it; handle staleness).
- This engine powers three features: (a) the "are you sure?" low-probability prompt, (b) the relative strength shown in match insight, (c) the differentiation between the 10 Claude Predicts sets.
- Define the threshold for "low probability" concretely (e.g. modelled win probability < 15% for the team the user advanced) rather than leaving it vague.

---

## 7. "Claude Predicts" — 10 prediction sets

Generate 10 full tournament predictions, each driven by a *distinct, stated football philosophy*, each with a one-paragraph rationale. They must be genuinely different (the probability engine and team profiles make this possible), not ten near-identical favourite-chalk brackets. Each is **selectable as a starting point**, after which the user can freely edit. Suggested philosophies:

1. **Chalk / ranking-led** — highest-rated team always advances.
2. **Form over reputation** — weight recent results and momentum.
3. **Underdog-friendly** — boost dark horses and debutants where plausible.
4. **Defensive-record-led** — favour teams that concede least.
5. **Star-power / talisman** — lean on individual match-winners.
6. **Host-advantage** — boost USA/Canada/Mexico and home-continent sides.
7. **Tournament pedigree** — favour serial deep-runners (Brazil, Germany, Argentina).
8. **Group-of-death survivors** — reward teams that come through hard groups.
9. **Heat & travel model** — factor venue climate / travel load across the vast geography.
10. **Contrarian** — deliberately fade one or two favourites for a bold final.

Each set should be reproducible/deterministic given the same inputs so users can trust them.

---

## 8. Guardrails & Easter eggs

- **Low-probability confirmation:** when a user advances a team whose modelled win probability is below the §6 threshold, show a non-blocking "Are you sure?" with the probability and a one-line reason. Confirm-to-proceed; never hard-block.
- **The "UK" Easter egg — corrected for reality:**
  - "The UK" at this World Cup means **England (Group L)** and **Scotland (Group C)** only — Wales and Northern Ireland did **not** qualify (both lost in the UEFA playoffs). Avoid calling it "the UK" in serious UI copy; reserve it for the joke.
  - **Germany (Group E) and France (Group I)** are not in England's or Scotland's group, so they can only meet a UK side **in the knockout stage**. The Easter egg must therefore be a **knockout-stage trigger**: if the user picks Germany **or** France to beat England or Scotland in any knockout tie, fire the playful "Are you crazy?? The UK is the best nation of them all!" prompt.
  - Keep it clearly light-hearted and skippable; don't let it block a legitimate pick.

---

## 9. UX & visual design (high priority)

- Clean, confident, sport-broadcast-grade aesthetic. Strong typographic hierarchy, restrained palette, flags/crests done tastefully and legally (use a permissively-licensed flag set; avoid official FIFA/team trademarked crests).
- Group stage: 12 group cards with editable mini-tables; clear "complete / incomplete" state per group.
- Bracket: horizontally scrollable / zoomable bracket that's legible on both desktop and mobile. Drag-and-drop on desktop, tap-to-advance on mobile.
- Persistent progress indicator ("8/12 groups predicted", "Round of 16 — 4 picks left").
- Insight surfaced contextually (hover/tap a fixture → expects/strengths panel) rather than dumped on screen.
- Accessibility: keyboard-navigable picks, sufficient contrast, screen-reader labels for fixtures.
- Distinguish *user picks* from *Claude Predicts suggestions* visually when a template is loaded.

---

## 10. Tech stack — decision

- **Recommendation: React + Vite (TypeScript), client-side only, no backend, for v1.** This app is fundamentally local interactivity + file import/export + cached static data. That's React's sweet spot with the least ceremony.
- **Choose Next.js only if** you commit to one of: server-side fetching/proxying of *live* results during the tournament, server-rendered shareable prediction pages with caching, or an API route to hide a third-party football-data API key. None are required for the core experience.
- State: a single typed store (Zustand or Context+reducer) holding `tournamentState`, derived selectors for tables/qualifiers/bracket.
- Data: `tournament.json` (draw + bracket map), `teams.json` (profiles) shipped as static assets; JSON save/load via Blob + file input.
- Keep all data in memory at runtime; the file round-trip is persistence (see §4).

---

## 11. Recommended build order

1. Confirm/lock the data: full draw (done above) + official R32 slot map + best-third allocation table. **Do this before coding** — everything cascades from it.
2. Group-stage model + table computation + third-place ranking.
3. Bracket engine wired to the official slot map, with cascade/invalidation.
4. JSON/CSV export + JSON import (schema-versioned).
5. Probability engine + team profiles (research/cache `teams.json`).
6. Match insight UI.
7. Claude Predicts (10 sets) on top of the engine.
8. Guardrails + Easter egg.
9. Visual/UX polish pass.

---

## 12. Open decisions to confirm before build

- **W/D/L vs scorelines** in the group stage (affects whether you can rank third-placed teams cleanly — see §2).
- **Static vs live data:** is v1 "predict the whole thing cold," or should it ingest real results as the tournament progresses and score the user's accuracy? (Live = Next.js + data source; bigger scope.)
- **Probability source:** ranking/Elo only, or blend in odds?
- **Flag/crest asset licensing** for the broadcast look without trademark issues.

---

*Tournament facts in this brief reflect the Final Draw of 5 December 2025 and the playoff results of 31 March 2026. Re-verify squad-level data nearer 2 June 2026, when FIFA confirms final squads.*
