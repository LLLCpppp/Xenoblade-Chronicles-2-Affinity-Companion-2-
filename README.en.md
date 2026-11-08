# Xenoblade Chronicles 2 Affinity Companion

[中文](README.md) · [日本語](README.ja.md)

An offline-friendly Affinity Chart tracker and Unique Monster planner for Xenoblade Chronicles 2. Recommended repository name: **`xc2-affinity-companion`**.

- Electra’s four Mastery of Thunder training nodes and Floren’s three Beguiling Charms nodes require manual progress; the other 30 ordinary conversation nodes remain Merc-eligible. Both confirmed rules override older labels.

## Run

Extract the project and open **`index.html`** in a modern browser. No installation, build, account or backend is required. Optionally serve the project with `python -m http.server 8000 --bind 127.0.0.1` and visit [localhost:8000](http://127.0.0.1:8000).

- Ordinary conversation counters can progress via Merc Missions, as confirmed by the player, overriding older labels. Heart-to-Hearts, designated story NPCs and quests retain their independent rules.
- If the current tier is blocked and the next tier requires something other than Trust, cards show “Manual progress required”. Trust-based unlocks keep their existing prompt; original requirements and Merc eligibility remain unchanged.

## Features

- Chinese, English and Japanese UI, with multilingual Blade, monster, node and region searches.
- The portrait picker opens by default and stays open after adding Blades. Blades are grouped as unrecorded, awaiting confirmation (amber), then confirmed (green). Selecting a portrait scrolls to its chart. Visual five-tier Affinity Charts support branch progress and Undo.
- **Complete entire chart** records every skill node and all five tiers for the selected Blade, synchronizes hunts, and supports Undo.
- Merc Mission verdicts consider only each branch’s immediate next node. Manual prerequisites cannot be skipped.
- Eligible roster cards show “Merc nodes: N (Trust M)”. Trust is a subset of those skill nodes, excluding tier unlocks; no new sorting option is added. Manual, uncertain and specific-mission conditions stop a branch. Tier locks are excluded; completion in one mission is not guaranteed.
- Sort by completed skill nodes or completion percentage; cards wrap into a grid with their current rank. Tier locks are excluded. Filter by overlapping progress categories.
- Remaining hunts stay synchronized with chart progress. Shared-monster requirements show other Blades, readiness and chart links.
- Only one Dagas form can be recorded at a time.
- Browser-local progress, JSON import/export and saved personal rules. No player-data upload endpoint.
- **Reset all Blades** asks for confirmation with a prominent warning, then clears recorded Blades, chart progress, hunt checkmarks, form backups and undo history. Personal rules remain. Export a backup first if needed.

## Data and translations

Snapshot: **2026-11-08**. Includes 55 recordable Blade charts, 493 branches, 2,188 skill nodes and 220 tier conditions. The hunt table has 82 nodes across 30 Blades: 50 verified unique-monster names, three uncertain enemy names and three requirements without a specific enemy name.

Conditions, portraits and links come from [xenoblade2.cn](https://xenoblade2.cn/异刃). The [Merc Mission page](https://xenoblade2.cn/佣兵团任务) supplies the base exclusion rules. Names prioritize the Wiki’s English/Japanese fields; auxiliary names and effects are matched by table and row ID against [Xenoblade Data](https://xenoblade.github.io/). Names without a verified match and explanatory text use project translations. See `locales.json` and [ATTRIBUTION.md](ATTRIBUTION.md) for provenance.

Chinese Wiki conditions remain authoritative and can be expanded in the chart details. Reports, CSV and original-data downloads remain in Chinese. Language switching never changes canonical save identifiers or source links.

## Save migration

Export your progress before changing browser, domain, file location, or moving from a local file to GitHub Pages; import it at the new address. Personal classifications travel with the backup and are not bundled as private player records in the repository. Missing personal rules remain uncertain instead of being assumed eligible.

This tool records progress; it does not modify game saves.

## Development and GitHub

Run `node tests/check.cjs` from the project root for data, rule, save and localization checks. Run `python scripts/build_standalone.py` to produce a single-file page in `dist/` using Python’s standard library.

For upload instructions, see [the GitHub guide](docs/GITHUB_UPLOAD.zh-CN.md) and [GitHub’s official guide](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github). The root `index.html` supports GitHub Pages using the `main` branch and `/ (root)` folder.

This is an unofficial fan tool. Third-party game text and artwork retain their owners’ rights. No project code license has been selected; see [attribution](ATTRIBUTION.md).

### Save to a local file

The Local progress file panel can autosave to a JSON file in browsers supporting File System Access, such as Chrome / Edge. Use Create and link file once, choose a location, and wait for Local file saved before closing. Reopen the same file using Open progress file each time you open this page. Chart progress, hunt checkmarks, personal rules and form backups are included.

Unlink file stops future writes and retains the browser cache. External file changes stop autosave until you reopen the file. Unsupported browsers retain JSON export/import. Loading a local file replaces the complete current progress; the original import action still merges records.
