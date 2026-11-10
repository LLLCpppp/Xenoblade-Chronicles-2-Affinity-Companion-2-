# 2026-11-10 数据修正

基础快照仍为 2026-11-08；以下是本次逐项核对后的修正。当前统计为 55 位可录入异刃、493 条技能分支、2,189 个技能节点、220 条阶段条件；精英讨伐为 29 位异刃、79 个节点（50 种已确认精英、3 条未指定名字的任意珍稀种条件）。历史复核报告中的旧计数保留，并加有本次修正说明。

## 斩铁：镌刻第三阶段

[Wiki 圆环](https://xenoblade2.cn/异刃:斩铁/牵绊圆环#镌刻) 将第三行误写为阶段 2。保留该行效果“必杀技造成的仇恨值提升80%”和条件“使用镌刻 0/8”，将展示阶段校正为 3，分支阶段恢复为 `[1,2,3,4,5]`。

对应游戏数据：

- [CHR_Bl#1049](https://xenoblade.github.io/xb2/bdat/common/CHR_Bl.html#1049)：`ArtsAchievement2=397`。
- [FLD_AchievementSet#397](https://xenoblade.github.io/xb2_cn/bdat/common/FLD_AchievementSet.html#397)：五个阶段槽依次为 `1756,1757,1758,1759,1760`，第三槽属于阶段 3。
- 条件链为 `List1758 → QuestList9679 → Next9680 → Purpose8340 → Achievement856`。
- [QuestTask#8340](https://xenoblade.github.io/xb2_cn/bdat/common/FLD_QuestTaskAchievement.html#8340) 为“使用镌刻”；[Achievement#856](https://xenoblade.github.io/xb2/bdat/common/FLD_Achievement.html#856) 为 `Count=8, DebugName=BLADE_ARTS2`。

数据中保留 `wiki_stage:2`、校正说明及游戏数据链接；节点详情可查看出处。

## M.O.M.O. :i：暗属性之力第五阶段

[Wiki 圆环所在页](https://xenoblade2.cn/异刃:M.O.M.O._:i#暗属性之力) 的第三行只有效果、条件两格，缺失阶段单元格，旧三列表格解析因此漏掉这一行。

补回内容：阶段 5；效果“暗属性异刃的能力”；条件“多多行走（可通过至今的累计数达成）0/400000”。行走条件按原有移动规则归为手动完成。前两条聊天条件及其完成数保持不变，分支阶段为 `[2,4,5]`。

对应 Switch 2 游戏数据（各表内相同行号）：

- [CHR_Bl](https://xenobladedata.github.io/xb2_sw2/common/CHR_Bl.html)：行 `1114`，`FskillAchivement1=1786`。
- [FLD_AchievementSet](https://xenobladedata.github.io/xb2_sw2/common/FLD_AchievementSet.html)：行 `1786`，`AbilityLevel=3`，五个阶段槽为 `[0,3906,0,3908,3909]`，对应阶段 `[2,4,5]`。
- 条件链为 `List3909 → QuestList13253 → Next13254 → Purpose10127 → TaskID2161`。
- [FLD_Achievement](https://xenobladedata.github.io/xb2_sw2/common/FLD_Achievement.html)：行 `2161`，`StatsID=60, Count=400000, DebugName=WALK_TOTAL`。

## 三种普通怪物移出精英讨伐

按玩家纠正并复核敌人页，移除：

| 异刃 | 节点／阶段 | 敌人 | 旧讨伐 ID |
| --- | --- | --- | --- |
| 鸣 | 暴力机关／3 | [铠甲钳蝎](https://xenoblade2.cn/敌人:铠甲钳蝎) | `b15-0` |
| 重音 | 感伤爆发／3 | [马格奈尔刺毛虫](https://xenoblade2.cn/敌人:马格奈尔刺毛虫) | `b21-0` |
| 重音 | 秘密欲望／4 | [清洗者刺毛虫](https://xenoblade2.cn/敌人:清洗者刺毛虫) | `b21-2` |

它们此前因任务／召唤分类被保守纳入“待定精英”，本次明确排除。原始圆环节点、效果与普通击倒条件继续保留，并恢复为普通佣兵可推进条件。其余讨伐 ID 不重新编号。

## 旧进度兼容

新存档携带独立的 `chartRevision:2`，存档格式版本仍为 2。读取未带标记或修订 1 的旧存档时，仅将斩铁“阶段 2、镌刻已完成 3 个”的记录调整为阶段 3，保留完成数并设为待核对。M.O.M.O. :i 只在末尾补节点，不挪动已完成的两条聊天记录。

旧存档中的三个退役讨伐布尔标记可读取并忽略；其他未知标记仍拒绝。缓存读取或校验失败时不以空进度自动覆盖原缓存。导入、关联文件载入和刷新均包含回归检查。
