# 页面设计、统计规则、API 与 Agent 数据导出

## 1. 页面与交互规范

新导航“拍摄数据” (/photo-data)，页面沿用 Geargrade panel、排版密度/宽度、深浅色主题、PageTransition 动画、响应式适配；图表沿用 Recharts。保持顶部指标和现有导航不互相覆盖。

页面从上到下：

1. 标题“拍摄数据”，副标题“基于本地文件元数据，分析拍摄习惯”；右侧显著“扫描更新”主按钮与作业状态，可选择来源；未点击不触发任何目录访问。
2. “上次成功扫描：YYYY-MM-DD HH:mm:ss（本地时区）”及“上次尝试扫描 / 状态”。首次进入显示“尚未建立索引”，而不是“0 张照片”。
3. 状态栏显示：来源数、已发布索引文件数、逻辑拍摄数、RAW 比例、图库体积、时间跨度。严格标注“物理文件”与“拍摄张数”的口径。
4. Lightroom 风格**多列动态筛选**：默认「年月 / 机身 / 镜头 / 格式」四列，最多八列自由字段与拖拽顺序，同列多选 OR、跨列 AND；可切换嵌套 AND/OR/NOT 高级规则模式，全部图表/明细/导出/排行榜共享版本化 AST。具体合同以 [FILTER_INTERACTIONS.md](FILTER_INTERACTIONS.md) 为准。不提供 GPS 或地理筛选。
5. 可切换分析子视图：**总览**、**器材**、**拍摄参数**、**拍摄时间**、**文件与质量**；小屏单列，桌面 2~3 列，图表空数据时保持空态与说明。
6. 底部“索引明细”表格：文件名/相对路径、拍摄时间、相机/镜头、格式、曝光、ISO、体积、解析状态；服务器分页排序、搜索、查看全 EXIF 抽屉。原片不预览、不下载。
7. “扫描记录/错误”抽屉：本次新增、更新、不变、移除、跳过与错误详细记录、开始/完成时间和可安全复制的诊断信息。
8. “导出数据”入口：选择 JSONL.gz、CSV.zip、summary.json、可选完整 JSON 包；默认隐私脱敏并显示是否包含路径/序列号；大包分片流式下载。GPS 和位置信息始终不导出。

设置页新增“拍摄数据源”：来源名称、容器内根路径（文本输入）、扫描是否启用、目录过滤/忽略规则、最后一次成功状态、删除来源（只删除配置/索引选项分开，后者二次确认）。保存和展示设置只查 SQLite，不探测源。根路径必须在 Docker 预设允许挂载列表内；明确提示“容器内路径，且需要 Docker 只读映射”。

页面视觉原则：数据可读性优先，图表悬停提示必须有单位、样本量、筛选口径；大样本图表服务端聚合，不能将几十万行文件明细一次发送浏览器；彻底不提供 GPS、地理位置、地图相关功能。

## 2. 统计指标与建议图表

| 视图 | 指标 / 图表 | 计算口径与条件 |
|---|---|---|
| 总览 | 总照片数、RAW 比例、物理文件数、存储体积、年度/月度趋势、全年日历热力图、按周时间分布 | 默认逻辑拍摄数 distinct capture_id；RAW 比例 = 含 RAW 的逻辑拍摄 / 已分类逻辑拍摄 |
| 器材 | 机身拍摄量排行、机身年度趋势、镜头使用率、机身-镜头组合矩阵、格式按相机对比、拍摄习惯随换机变化 | 优先 canonical key；遇未识别品牌单列 Unknown；重复购入不盲目合并具体档案 |
| 拍摄参数 | 焦距分布/等效焦距分布、ISO 分布、快门速度分布、光圈分布、曝光补偿、ISO×快门热力、焦距×光圈密度图 | ISO/焦距等依据有效非空数据；快门使用对数分桶；等效焦距不得无依据推断 |
| 拍摄时间 | 拍摄年份/月/日/小时、星期×小时热力图、活跃日期分布、长期拍摄频率与间隔趋势 | 无可信时区时展示相机记录的本地日期；不开展地区、位置或地图统计 |
| 文件与质量 | RAW/JPEG/HEIF 格式占比、RAW+JPEG 同拍率、分辨率分布、输出纵横比、目录体积、失败/缺失元数据统计 | 独立展示物理文件数与逻辑拍摄数；数据完整度按字段分母计算，不把缺失计为 0 |

在已有「评分榜 / 持有时间榜 / 理财榜」后增加第四 Tab **「拍摄使用量榜」**，按机身/镜头 Canonical 型号及真实逻辑快门次数排行、已售设备保留；详细口径参见 [USAGE_LEADERBOARD.md](USAGE_LEADERBOARD.md)。

默认 KPI 和每张图都公开样本范围：例如“ISO 中位数（有效 ISO 的 12,304 / 20,110 张）”。删除状态的索引不进入默认统计。可过滤显示“文件数统计”便于核对实际文件。按拍摄时间的日历必须区分 fallback 文件修改日期，避免虚假的摄影活动高峰。

## 3. REST API 草案（全部新增，前缀 /api/v1/photo-data）

| 方法 + 路径 | 语义 |
|---|---|
| GET /sources | 已保存来源配置与历史扫描信息；不碰目录 |
| POST /sources | 新增来源（仅保存配置）；校验词法目录 |
| PATCH /sources/{source_id} | 修改描述、路径、启用状态、规则；不触发扫描 |
| DELETE /sources/{source_id} | 默认移除配置但保留历史索引；需确认可选 purge_index |
| POST /scan | 用户点击启动；body: source_ids[], mode=incremental/deep；409 并行冲突；返回 202 + job_id |
| GET /scan/{job_id} | 作业状态、阶段、完成/失败计数；不碰目录 |
| POST /scan/{job_id}/cancel | 请求取消 |
| GET /scan/history | 最近已保存的成功、失败和中断历史 |
| GET /summary | 当前已发布快照全局/筛选后 KPI |
| GET /stats/{chart_key} | 指定图表的服务端聚合；白名单 chart_key |
| GET /files | 元数据明细分页、过滤、排序、搜索；简单条件兼容接口，复杂条件统一走 AST query API |
| GET /filter-fields | 字段注册表、字段有效覆盖率与支持的运算符（不读原目录） |
| POST /query | 版本化多列/高级规则 AST，返回分页命中结果 |
| POST /facets | 自排除列分面选项及计数（仅 SQL） |
| POST /stats/query | 复用 AST 的多图表聚合 |
| GET/POST/PATCH/DELETE /filter-presets | 保存/读取/变更/删除筛选预设；路由最后一段详见 FILTER_INTERACTIONS.md |
| POST /leaderboard/query | 高级筛选驱动的摄影使用量排行榜，详细参见 USAGE_LEADERBOARD.md |
| GET /files/{file_id} | 完整标准字段与可用原始标签抽屉数据（需访问控制；DB-only） |
| GET /aliases | 原始设备名称与匹配状态 |
| PUT /aliases/{id} | 用户确认或撤销设备别名关联 |
| POST /exports | 以筛选 JSON + 脱敏设置创建一次性导出或流式响应；只读 DB |
| GET /exports/{export_id} | 导出结果/下载状态；只读 DB 与 app data 导出缓存，不访问照片源 |

响应 Schema 统一包括 schema_version、snapshot_id、as_of（成功扫描发布时间）、filters、counts、warnings；数据来源为“最后一次已发布完整扫描”。无数据返回空列表/空数组、说明 unavailable，而非 500。时间采用 ISO 8601（包含时区或明确 local/unknown），大小以 bytes、焦距 mm、曝光秒记录，不定义或返回任何位置或 GPS 字段。API 拆分统计和扫描作业，禁把前端多图表请求变成扫描触发器。

示例（草案，不是当前已运行 API）：

~~~json
{
  "schema_version": "geargrade.photo-data.v1",
  "snapshot_id": "photo-snapshot-000042",
  "as_of": "2026-10-09T07:40:00Z",
  "counts": {
    "physical_files": 125000,
    "logical_captures": 73200,
    "raw_files": 67000,
    "jpeg_files": 53500,
    "missing_tombstones": 90
  },
  "warnings": []
}
~~~

上述数字纯属 Schema 示例，不代表用户实际文件量。

## 4. 数据导出协议

另设 **geargrade.photo-data.v1**，与现有 geargrade.ggpack.v1 分离；绝不将拍摄元数据强行塞入 devices/wishlist 表，更不改变旧版 GGPack 格式与重置规则。

- 推荐默认：按过滤条件生成 .zip，内含 manifest.json、photos.jsonl.gz、captures.jsonl.gz、summary.json、schema.json（字段解释）、errors.jsonl（可选）；照片与逻辑拍摄分表，便于 Agent 无歧义分析。对 CSV 用户提供 photo_files.csv、captures.csv、aliases.csv、scan_runs.csv 等表的 zip。
- 每行完整、同名键、UTF-8；JSONL 一行一个对象；按稳定 file_id 排序，可流式分片/断点导出。浮点/日期保留字段定义，NULL 不替换为零。
- manifest 必须带 format、schema_version、exported_at、index_as_of、sources（脱敏源 ID）、exiftool_version、metadata_normalizer_version、filters、totals、units、timezone_policy、dedup_policy、privacy_policy、files 校验摘要。外部 Agent 不应依赖内部 SQL 自增主键在跨机器导出中完全一致。
- 默认**不包含**绝对目录路径、相机明文序列号与完整 raw_exif；relative_path 默认可用不可逆 ID 代替，UI 可显式按需增加相对路径、经脱敏审查的非定位 EXIF 字段。所有 GPS / 位置标签一律禁止导出，即使是用户请求完整 EXIF。
- MakerNotes 可以包含隐藏的位置/设备身份信息；入库前即采用位置字段 denylist + 合法安全字段 allowlist 清洗，原始全量 ExifTool JSON 不得绕过 GPS 剔除规则，导出再实施敏感字段审查；“默认脱敏”不等于保证完全匿名。
- 导出仅从 SQLite 和 app data 缓存读取，不得扫描原始照片目录；可选择是否包含 soft-delete 记录（默认否）、扫描错误（默认摘要）。
- 数据可离线使用，无网络依赖；建议使用 JSONL.gz 流式解压，避免把大型数组一次装入 Agent context。

## 5. 视觉交互和无障碍验收

多列布局、列自排除 Facet、快捷筛选 Chip、高级规则编辑器、URL 回退与键盘/触屏完整交互见 [FILTER_INTERACTIONS.md](FILTER_INTERACTIONS.md)。

- 扫描按钮在 RUNNING/QUEUED 阶段禁用重复提交；显示本次扫描对象、计数和进度，无已知总数时只显示已处理计数，不伪造百分比。
- 顶部固定上次成功扫描时间，进行中与失败时不消失；失败时显示可重试原因且旧数据仍可查看。
- 图表与表格筛选共享 URL state，点击柱状图进行交叉筛选，触屏可用；表格千级以上使用分页/虚拟滚动。
- 增加简化模式、减少动态效果和移动端断点的适配，图表可键盘操作并提供文本化图例/表格替代。
- 所有图表 tooltip 不能裸露用户全路径或机身完整序列号；不支持经纬度/位置数据。