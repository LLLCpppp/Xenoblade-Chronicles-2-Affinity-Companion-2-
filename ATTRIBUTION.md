# Sources / 出典 / 来源

- Original Blade list, portraits, chart conditions and source links: [乐园数据管理室 / xenoblade2.cn](https://xenoblade2.cn/异刃). Individual page and image URLs are preserved in `data.json`.
- Base Merc Mission exclusions: [佣兵团任务](https://xenoblade2.cn/佣兵团任务#解锁牵绊圆环). Player-confirmed additions and personal classifications are distinguished in the dataset and UI.
- English/Japanese Blade names: the English and Japanese name fields of the corresponding Chinese Wiki Blade page. Base Dagas names retain the Wiki spelling; “Awakened / 覚醒” is an added form label for the two exclusive records.
- Auxiliary localization: [Xenoblade Data (English)](https://xenoblade.github.io/xb2/), [日本語](https://xenoblade.github.io/xb2_jp/), [中文](https://xenoblade.github.io/xb2_cn/). Names/effects are matched by table and row ID, with source references in `locales.json` (`sources`, `fieldSources`). Alternate punctuation and documented Chinese spelling differences are mapped without changing the original condition.
- Secondary Wiki consulted during name checks: [Xenoblade Wiki: Zenobia](https://xenoblade.fandom.com/wiki/Zenobia), [Unique Monsters](https://xenoblade.fandom.com/wiki/Unique_Monster_(XC2)). These references do not replace the Chinese Wiki condition or a verified same-ID localization match.
- Unmatched names, UI and explanatory text: project translations. These are not presented as verified official localizations. Chinese source text remains available for comparison. `project-translation` marks unmatched entries; `wiki-with-form-label` identifies the added Dagas form suffix.
- Original collection and rule audits: the Chinese HTML reports shipped with the project. This language update is not represented as a new independent agent audit.

Snapshot and localization research date: 2026-11-08.

Game titles, characters, artwork and third-party text retain the rights of their respective owners. This is an unofficial fan tool. Attribution is not a new license or a claim of permission from those owners. A code license has not yet been selected for this repository.

Player update: 30 ordinary conversation-counter nodes are confirmed by the player as Merc-eligible, overriding older personal labels. Independent Heart-to-Heart, story NPC and quest conditions retain their original rules. A non-Trust next-tier condition prompts manual progress only when the current tier is blocked; this does not change the source requirement or its Merc eligibility. Original Wiki text is unchanged. Trust counts exclude tier-unlock rows.

Player correction: Electra’s four training nodes and Floren’s three Beguiling Charms nodes require manual progress, overriding old labels. Only the other 30 ordinary conversation nodes remain Merc-eligible. Wiki condition text and sources are preserved.

2026-11-10 corrections: Sever’s third Engrave node is on chart tier 3 (AchievementSet 397, slot 3); MOMO (i) Dark Mastery adds the missing tier-5 WALK_TOTAL 400000 node (Set 1786, slot 5). Wiki effect/condition text is retained with game-data correction sources. Three player-confirmed ordinary enemies were removed from hunts, and their original chart requirements remain eligible normal kills. See docs/DATA_CORRECTIONS.zh-CN.md.
