# 摄影设备拍摄使用量榜（现有排行榜新增第四榜）

> 产品/接口设计 v1.1。仅基于最近一次**成功发布**的 photo_index.db 快照，绝不能触发目录扫描。此文档是规格，不表示已实现。

## 1. 入口与展示

复用 /leaderboards 页面，现有 Tab「评分榜」「持有时间榜」「理财榜」后新增「拍摄使用量榜」（建议 tab=photo-usage）。沿用当前页面 Top 3 podium + 完整排名 + 深/浅主题、紧凑/简化模式、排序的视觉系统，允许从拍摄数据总览的机身/镜头统计跳转相同榜单。

榜内二级切换：
- 「机身」默认：普通相机 + 运动相机 + 无人机的**静态照片**，按 Canonical Make/Model 排行；可选择仅相机/仅运动相机/仅无人机，视频不计入。
- 「镜头」：按能可靠识别的 Canonical Lens Make/Model 排行；固定镜头机身的镜头可在可证明映射时单独列为镜头（标注内置镜头）。
- 「机身 × 镜头」作为 P1 统计视图（非必需独立第三排行）；防止同一个单拍多维交叉导致额外重复计数。

提供全历史 / 年度 / 月度 / 自定义日期范围；支持共享 Lightroom 式筛选 AST（机型、镜头、RAW、ISO 等），并明确显示筛选 Chip 和已发布快照时间。当前排行榜通用的 category chips 应在拍摄使用量 Tab 替换为器材种类与二级选项，避免向用户提供配件、三脚架等不可计算的器材排行。排序默认拍摄次数降序，仍支持升序与指标切换。

## 2. 口径与可比性

**主指标 = 去重后的逻辑快门拍摄次数（distinct capture_id）**，不是物理文件数。RAW+JPEG/HEIF 同次拍摄计一次，单独只保存 JPEG 的快门也计一次；多帧连拍各帧不同 capture；机器不同来源的复制副本不得无证据跨 source 合并，若未显式去重，展示“跨来源重复可能增加计数”的说明。

照片实例应只归属一个 canonical camera；若 RAW 与同组 JPEG 相机信息冲突、或多个 source 模糊匹配，同张归类“待确认/歧义”，不得计入多个机身分子。镜头信息不可辨识则归“镜头未识别”，不会悄悄算作机身自带镜头。

所有时间界限统一按可得的原始拍摄本地日期比较；用户指定年份筛选后，该年份确实已索引的拍摄才进入分母。设备售出状态或购买轮次**不限制**历史拍摄归属：已售设备也必须上榜；相同型号重复购入先归型号聚合，只有用户人工映射 / 足够可靠的序列号证据才能拆成 Geargrade 的某次具体持有记录。无可靠匹配的 EXIF 机型仍上榜，并标记「未收录到 Geargrade」，不能从排名中隐藏。

### 统计指标与分母

| 字段 | 精确定义 |
|---|---|
| capture_count | 符合当前筛选、已发布、实际存在且可确定归属该 canonical 机身/镜头的 DISTINCT capture_id |
| total_captures | 当前过滤下全部可用逻辑拍摄数，含未知型号；显示在页头 |
| attributable_captures | 当前过滤下可可靠归属此类器材的逻辑拍摄数（用于排行榜分母） |
| usage_share | capture_count / attributable_captures × 100%；显示样本覆盖率 attributable_captures / total_captures |
| all_photo_share | capture_count / total_captures × 100%，默认可在详情中查看 |
| active_days | 当前过滤集内具有可信本地日期的 DISTINCT 拍摄日数 |
| first_shot_at / last_shot_at | 当前过滤集的最早/最晚可信拍摄时间；若只有文件修改时间 fallback，必须单独标注不能视为真实拍摄 |
| avg_per_active_month | 当前筛选内有实际拍摄的 DISTINCT 年月个数作为分母；若无有效拍摄日期返回 NULL；不得用持有月份替换或在横跨多年但空闲很多个月时称为“日历月均” |
| physical_files | 可选次级信息：符合过滤的原始文件数，单独标示而不是主排名 |

「使用最多」默认按 capture_count。可选按 active_days / usage_share / avg_per_active_month；同值并列允许共同显示排名，随后按稳定 normalized_key 字典序排展示顺序。**排名序号使用竞赛排名**（1,1,3），不得因列表分页导致排名重置。用户可选择仅当前持有设备，但默认显示全部历史并标售出状态；未匹配的设备显示「未关联」，不可根据售出日期推断该照片一定由某一持有记录拍摄。

例如 A7M4 同次 RAW+JPEG 有 1,000 组，加上 JPEG 单拍 200 组，该机身 capture_count=1,200；物理文件则可能是 2,200。数字只是算例。

## 3. 卡片与详情交互

- Top 3 卡展示排名、型号、品牌、有效拍摄次数、使用占比、活跃天数和 Geargrade 关联状态；没有照片数据时显示「还没有完成一次成功扫描」，绝不使用现有器材购买数代替拍摄量。
- 完整排名行允许展开 ISO/焦距/年月趋势摘要，点击具体相机/镜头打开 Geargrade 设备详情**仅当绑定确切唯一 asset device_id 且有权限**。否则打开「拍摄数据」并用 camera.model_norm 或 lens.model_norm 过滤照片列表，显示「型号未绑定 / 多次购入未能确定归属」。
- 出售状态只作为装饰性信息，不在默认榜中排除；设备页面可增加「拍摄记录统计」入口，返回对应型号/过滤器。
- 数据不完整时展示「未识别机身拍摄：N」「未识别镜头拍摄：M」与可用率；未知组可作为诊断行显示，但不能被误排成 TOP 1 某型号。
- RAW+JPEG 显示一个 count，悬停/详情分开给出物理文件数、配对数与错误统计；数据仍允许导出相同筛选范围 JSONL / CSV。
- 排行榜、拍摄数据页图表和导出共享同一个 AST、snapshot_id、去重原则与设备归一化版本，禁止同条件显示不同排行数据。

## 4. API 与模型合同

- 新增 GET /api/v1/leaderboards/photo-usage?kind=camera|lens&sort_order=desc|asc&metric=captures|active_days|usage_share|active_month_avg&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=100&cursor=...；简单过滤也可以指定 canonical model/category。
- 新增 POST /api/v1/photo-data/leaderboard/query，复用 FILTER_INTERACTIONS.md 的 AST，body: {filter, kind, metric, sort_order, limit, cursor}，处理嵌套组合条件；两端共享相同聚合服务，GET 为便捷简化表达。
- 响应包含 snapshot_id、filter_hash、as_of、kind、metric、totals(total_captures/attributable_captures/unknown_captures)、items、next_cursor、normalizer_version、warnings；按 canonical key 聚合而不是盲目使用设备表 id。

~~~json
{
  "schema_version": "geargrade.photo-data.v1",
  "kind": "camera",
  "metric": "captures",
  "snapshot_id": "published-snapshot-id",
  "totals": {
    "total_captures": 2000,
    "attributable_captures": 1800,
    "unknown_captures": 200
  },
  "items": [
    {
      "rank": 1,
      "canonical_key": "sony:ilce-7m4",
      "name": "Sony A7 IV",
      "capture_count": 1200,
      "usage_share": 0.6666667,
      "active_days": 120,
      "first_shot_at": "2025-01-01T12:00:00",
      "last_shot_at": "2025-12-31T20:00:00",
      "linked_device_id": null,
      "link_state": "ambiguous_acquisition"
    }
  ]
}
~~~

JSON 中的数据均为接口示意，非历史图库实际数据。usage_share 使用 0~1 小数传输，前端按百分比显示。该榜不应复用现有 LeaderboardBaseItem 的必需 device_id/score/daily_cost_value；需要单独类型 PhotoUsageLeaderboardItem。已有三个排行接口、格式、排序和数据互不改变。

## 5. 服务端实现与测试

- 在 photo_index.db 上按 snapshot_id + capture_id + canonical key 做去重聚合；根据类型拆分机身/镜头，联合 photo_device_aliases 获得绑定状态；原 geargrade.db 的 device_id 只作可空软关联。
- 索引建议 photo_captures(model_norm, captured_at)、photo_metadata(lens_norm, capture_at_local)、关联表 capture_id/photo_file_id 和来源键；对常用年份+型号排名可生成增量物化汇总，但快照切换时必须失效。
- 必测：RAW+JPEG 计 1；连拍多张独立计数；无 EXIF 型号不误归属；已售设备保留；同型号重复购入聚合；同名不同机型不混；多机身冲突归歧义；无镜头元数据不假推；筛选指定年份及日期范围正确；高 ISO 条件与元数据多列一致；一键进入筛选列表保留条件；全部仍不触碰源目录；无首次成功扫描显示空态；导出与排行榜同口径。
- 目标：排行榜在 10万/50万张图库规模由后端聚合，不将全量明细发给前端；P95 目标通过性能实测评估，不事先承诺固定响应时间。
