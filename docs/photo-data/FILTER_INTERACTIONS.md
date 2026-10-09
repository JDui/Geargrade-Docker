# Lightroom 式多列动态筛选与高级条件表达式

> 设计规范 v1.1；仅针对 Geargrade「拍摄数据」已发布的本地 SQL 元数据索引，不会访问原始目录。本文为实施合同，不表示现有 UI/API 已实现。交互参照 Adobe Lightroom Classic 的 Library Metadata Filter 与 Smart Collections，增加嵌套布尔逻辑，不追求一比一复制 Lightroom。

## 1. 信息架构与两种互补模式

「拍摄数据」页面固定提供顶部的【筛选】区域，分为两个工作模式：
- **元数据列（默认）**：桌面默认显示 4 列「拍摄年月 / 相机 / 镜头 / 文件类型」，可修改每列字段、拖动换序、增加/删除列（1–8 列）、恢复默认。每列内部选择多个值为 OR，多列间为 AND。允许单列多选「未知/未记录」。栏目增加不意味着新建源目录扫描。
- **高级规则**：可递归编辑 AND / OR / NOT 条件组，支持混合字段、排除值、数值/日期范围和缺失值。可将元数据列的筛选无损转换成 AST 高级规则；无法逆向表示为列的复杂 AST 在返回列模式时保持为只读「高级附加条件」提示，不能悄悄丢弃规则，切换列仅修改可表达部分。
- 顶部始终有当前结果数量、当前统计口径（逻辑拍摄 / 物理文件）、当前成功快照时间、全部筛选条件 Chip、清空筛选、保存预设、导出筛选结果、重置默认列配置。结果为 0 时显示「当前条件无匹配」而非误报数据库为空。
- **搜索独立但统一到 AST**：右侧文本框支持文件名、型号、镜头、关键字（若可得）的搜索，直接作为 AND 条件而不是另一套不可见的过滤逻辑。
- 所有操作只查询 photo_index.db 已发布快照，绝不能 stat、open、list 或调用 ExifTool 读取源目录。

### 示意结构（非已实现页面）

~~~text
拍摄数据  [上次成功扫描: 2026-10-09]  [扫描更新]
[元数据列] [高级规则]    搜索 [________________]   [保存预设]
[拍摄年月 ▼]    [相机 ▼]      [镜头 ▼]       [格式 ▼]   [+ 增加列]
  2026 (120)     A7M4 (80)      28-200 (40)    RAW (90)
  2025 (80)      E-P7 (45)      DJI15 (30)     JPEG (75)
  2024 (50)      X100V (25)     未记录 (10)   HEIF (5)
[条件: 2025] [相机: A7M4 或 E-P7] [格式: RAW] [清除全部]
匹配 125 次拍摄 | 180 个物理文件     [保存] [导出]
[所有统计图表跟随当前筛选]  [已索引文件分页表]
~~~

数量仅是示意；并非用户图库的测量结果。

## 2. 列操作精确定义

- 点击列标题选择字段；可按标签分组搜索字段，显示字段类型/可用率/是否来自厂商 MakerNotes，默认仅显示有实际有效数据的字段；「显示无数据字段」可开启以排查数据缺失。
- 列内每个值显示已发布快照下的聚合数量；可单选/多选/全选当前搜索结果/清除本列/反选当前结果；键盘 Ctrl/Command 切换单个选项，Shift 连选列表顺序范围；普通点击可设为单选，常驻「多选」模式应可开启以适配移动端。所有行为须可由鼠标、键盘与触控完成。
- 本列选中值是集合；当为空代表「没有该列条件」，不是「匹配空集合」。相同字段出现在两个列时，两列仍为 AND，UI 给出可能冲突提示但不偷偷合并条件。
- 列间默认 AND，且允许一列显示「排除这些值」产生 NOT IN（NULL 不会隐式匹配）。复杂跨列 OR 使用高级规则编辑。
- 级联计数采用**自排除分面计算**：请求第 X 列选项时，先应用其他全部已激活条件（包含独立文本搜索与高级附加条件），再移除第 X 列自己的整组条件，得到每个候选值计数。这样选中某个相机后本列其他相机仍有有意义数量。表格/图表/总命中数始终应用所有条件，不能与分面计数混淆。
- 选中值即使在当前筛选上下文里计数为 0，也必须继续展示为已选；显示「未记录」时区分 NULL、确实值为 Unknown 字符串、解析失败（parse_status）。选项默认按 count DESC、label ASC，支持字母顺序和数值大小顺序、字段内搜索、可选层级（年月日与文件夹）。
- 新增列默认不加筛选。删除一个含筛选条件的列时明确提示该条件将被移除，支持撤销；排序和列增删操作不影响已选值的底层编码。
- 期望桌面视口显示 4 列、宽屏 6–8 列；容器窄时横向滚动而不是让所有列压成不可读；移动端使用横向分页列卡片 + 固定的已选条件摘要；不能把每个值都渲染进 DOM（长列表虚拟化与服务端分页/前缀搜索）。
- 当某字段源数据全部 NULL，默认隐藏该字段，但「显示无数据字段」时可选并返回 0 有效值及缺失总数。

## 3. 条件运算符与 NULL 语义

| 字段类型 | 运算符 | 输入组件 |
|---|---|---|
| enum / hierarchical | eq, ne, in, not_in, is_missing, is_present | 多选列表、搜索、层级选择 |
| number | eq, ne, gt, gte, lt, lte, between, outside, is_missing, is_present | 范围滑杆 + 精确数字 + 自定义步长 |
| date / datetime | eq_day, before, after, between, relative_period, is_missing, is_present | 日历范围与快捷时间段 |
| text | equals, not_equals, contains, not_contains, starts_with, ends_with, in, is_missing, is_present | 关键词输入 |
| boolean / tri-state | is_true, is_false, is_unknown | 三态单选 |
| list / tags | includes_any, includes_all, includes_none, is_missing, is_present | 可检索标签多选 |
| special relation | any_file, all_files, capture_has_raw, capture_has_jpeg, has_pair, is_unmatched | 特殊的文件分组条件 |

所有比较中的缺失值是 SQL NULL，不等于字符串空格/unknown 或数值 0：ne、not_in、not_contains、outside 对 NULL 返回不匹配；必须显式 is_missing 才匹配缺失值。NOT 组应使用二值逻辑的明确补集语义：叶子对 NULL 返回 false，NOT(leaf) 返回 true；产品 UI 必须说明这点，并要求用户用 is_missing / is_present 取得可预期结果（例如 NOT(ISO>=1600) 包括缺失 ISO，ISO<1600 不包括缺失 ISO）。

日期按照片记录的本地拍摄日历聚合；无时区原始时间绝不能被凭空转换为 UTC；relative_period 仅查询时动态计算，不产生新文件扫描。数值单位统一保存在数据库：快门秒、焦距 mm、文件大小 bytes、光圈数值 F、曝光补偿 EV。UI 可接受 1/250 s、50 mm、16 MiB 形式输入，但必须校验并转换为标准值；起止端默认均包含（between inclusive）。线性/对数分桶只影响图表显示，不改变比较谓词。

## 4. 字段注册表（作为单一可信来源）

必须实现后端字段注册表 PhotoFilterFieldRegistry，再通过 GET /api/v1/photo-data/filter-fields 暴露给前端。每字段：field_id、label、group、value_type、scope(capture/file/device)、operators、unit、availability、nullable、source_tags、normalizer_version、facet_mode、min/max、privacy_class、requires_enrichment、sortable、available_count、unknown_count。前端从注册表渲染，绝不可用用户输入的字段名拼装 SQL 字段或 JSON 路径。

| 分类 | 预期筛选字段（示例） | 可用条件 |
|---|---|---|
| 时间 | capture_at_local、year/month/day、weekday/hour、capture_time_source、file_mtime、first_indexed_at | 文件时间和 EXIF 为基础，其他派生 |
| 机身 | camera_make/model、camera_serial_hash、firmware、sensor_format、Geargrade 设备匹配状态/持有状态 | 机型基础；序列号、固件和画幅需要合法来源 |
| 镜头 | lens_make/model、lens_id、focal_mm、focal_35mm_mm、mount、prime_or_zoom、Geargrade 镜头匹配状态 | 未匹配及镜头缺失有独立值 |
| 曝光 | iso、exposure_s、f_number、exposure_comp_ev、metering_mode、exposure_program、flash、white_balance、color_temperature_K | 条件字段按来源与机身差异显示有效率 |
| 高级机身参数 | focus_mode、AF_area、AF_point、shutter_type、drive_mode、stabilization、burst_mode、HDR、high_res、live_ND、picture_style、film_simulation、creative_look、noise_reduction | MakerNotes 存在才开放；无值不解释为关闭 |
| 文件 | source_id、relative_directory、extension、detected_format、format_family、size_bytes、width_px、height_px、megapixels、aspect_ratio、orientation、bit_depth、compression、color_space、ICC、software、parse_status | 文件与成像字段混合，跨物理文件需规定语义 |
| 关联 | has_raw、has_jpeg、has_heif、raw_jpeg_pair、capture_group_confidence、geargrade_link_state、file_presence_state | 用 capture / file 分离的派生状态 |
| 管理数据 | rating、color_label、pick_flag、keyword、creator、copyright、has_edits | 仅可验证的 XMP/IPTC/管理元数据；没有导入则标 unavailable |

不得创建 GPS/经纬度/地理名称/地图/地理反查字段，包括 MakerNotes / 原始 EXIF 原始标签搜索入口。未知相机序列号不以明文出现在 UI；允许内部不可逆 hash 用于区分，但不可作为任何地理识别手段。

初始默认常用字段：拍摄年月、相机、镜头、文件类型；快捷候选：ISO、光圈、快门、焦距、来源、RAW+JPEG、图像尺寸。字段进阶对话框按类目分组，列出实测可用率；新厂商字段增加后通过 registry 和 normalizer 版本化引入，而不修改整套筛选 UI。

## 5. AST 是唯一查询语义（UI、统计、排行、导出共用）

定义带版本的只读查询模型：

~~~json
{
  "version": "photo-filter.v1",
  "scope": "capture",
  "snapshot_id": "last-published",
  "group": {
    "op": "and",
    "children": [
      { "field": "capture.year", "op": "eq", "value": 2025 },
      {
        "op": "or",
        "children": [
          { "field": "camera.model_norm", "op": "eq", "value": "sony:ilce-7m4" },
          { "field": "camera.model_norm", "op": "eq", "value": "olympus:e-p7" }
        ]
      },
      { "field": "exposure.iso", "op": "gte", "value": 1600 },
      { "field": "files.format_family", "op": "any_file", "value": "raw" },
      { "op": "not", "children": [{ "field": "lens.model_norm", "op": "is_missing" }] }
    ]
  },
  "sort": [{ "field": "capture.capture_at_local", "direction": "desc" }],
  "page": { "cursor": null, "limit": 100 }
}
~~~

- group.op 仅有 and/or/not；NOT 恰有一个 child；最大嵌套深度 5、节点总数 50、IN 值数 500、字符串最大 256 字符。对不支持 operator 的字段返回 HTTP 422 和明确的错误位置，任何未知字段/JSON path/SQL 片段拒绝。
- scope 默认 capture（逻辑拍摄）。file scope 统计物理文件，两个视图结果独立标示；切换 scope 时保留可表达条件，并提示不兼容规则。RAW+JPEG 在 capture 视图中按单个 group 计算。
- capture 规则判断所属物理文件的属性须使用 EXISTS 语义，例如「至少一个 RAW」；不要因多个 photo_files JOIN 使捕获或排行榜重复计数。同一文件属性组的联合条件（如 format=RAW 且 size>20MiB）应通过显式 file_any 子组绑定在同一个 file_id，避免分别由两个不同文件满足而误算。
- capture 使用曝光字段取稳定的代表文件（优先相机原生 RAW，否则可靠 JPEG/HEIF；冲突或缺失时保留 provenance）；如需要查询「所有物理文件」用 file scope。多个 RAW 等异常组合不得凭任意第一个决定一个机身。
- AST 的真值判定只由后端实现；前端只生产、显示并序列化。保存的预设持久化完整 AST + UI 列布局（source、列顺序/宽度、选中集）+ schema_version；打开旧版本预设时明确提示字段已弃用/迁移，绝不丢字段静默降级。
- 内部 AST canonicalize（节点排序、值去重、类型转换）并生成稳定查询 hash；基于 snapshot_id + hash + user scope 的缓存键；翻页、分面与导出须锁定同一个 snapshot 版本。默认 URL 可以包含安全压缩/编码的轻量查询，过长时持久化预设/临时共享查询 token（仅服务端解析）；禁止把原始 SQL/隐私路径直接拼入 URL。

## 6. 高级规则编辑器交互

- 顶部总组可选「满足全部 / 任意」，任意条件旁 [添加条件] [添加条件组] [取反] [删除]；嵌套组标清 AND/OR/NOT；可展开 JSON 只读检查器便于 Agent 调试与重现。
- 字段选择 -> 操作符选择 -> 自适应数值/日期/枚举/三态输入，缺失字段实时显示「当前数据不提供」并允许作为已保存规则保留；错误值阻止提交，显示原值与修正建议。
- 条件 Chip 同步高亮，移除某 Chip 必须精确删除其对应节点；嵌套 OR 不得展平成多条默认 AND。Undo / Redo 最少 20 步，清除筛选有撤销入口。
- 浏览器后退/前进恢复完整条件、筛选模式、排序与页码；取消过时异步请求（AbortController），新请求期间可展示旧图表并明确 loading，禁止旧响应覆盖新结果。
- 图表柱状图点击添加相应谓词、Shift 追加 OR 值、Alt/Option 点击排除（移动端提供菜单）；与元数据列通过统一 AST 同步。点击「拍摄使用量榜」某机身跳转时追加对应 canonical model 谓词，不能丢失现有日期/格式过滤条件。
- 预设包括「全部照片」「高 ISO 夜景」「RAW 单拍」「RAW+JPEG」「某台机身 × 某镜头」等建议初始模板；模板名称可编辑。预设管理只更新本地 DB，不发起扫描。

## 7. REST API 与性能约束

| Method / Endpoint | 输入 / 输出 |
|---|---|
| GET /api/v1/photo-data/filter-fields | field registry / schema_version / 有效数据占比 / 字段类型 |
| POST /api/v1/photo-data/query | 接收 AST，返回匹配总量、物理文件与逻辑拍摄数、可分页行、snapshot_id |
| POST /api/v1/photo-data/facets | AST + column_id + exclude_column_id / facet_mode；返回分页 options/count，保留 selected |
| POST /api/v1/photo-data/stats/query | AST + chart_keys 白名单；返回联动图表聚合及口径 |
| GET /api/v1/photo-data/filter-presets | 读取已保存条件与列布局 |
| POST /api/v1/photo-data/filter-presets | 保存并校验可版本化 AST 与布局 |
| PATCH/DELETE /api/v1/photo-data/filter-presets/{id} | 重命名、改条件、删除 |
| POST /api/v1/photo-data/exports | 复用相同 AST + 固定 snapshot_id；隐私默认脱敏 |

兼容既有 GET /summary、GET /stats/{chart_key}、GET /files（无过滤或简单 Query）。**复杂表达式只通过上述 POST JSON 请求体**，规避 URL 长度限制；任何筛选端点仍为本地索引只读操作，不访问源目录。接口结果包含 requested_scope、snapshot_id、effective_filter、matched_captures、matched_files、facets_policy、field_coverage、warnings。

聚合必须交给 SQL（SQLite，允许物化摘要/增量索引），绝不能浏览器读取 10 万行后过滤；频繁使用的 capture 时间、型号、镜头、ISO、焦距、来源、格式、分组关联需显式索引/物化 facet 索引。多对多场景优先 EXISTS / 去重捕获 ID，而非行级 join 导致重复。服务端分页并限制 limit <= 500、facets <= 100 / page、每请求 max 8 columns，按 snapshot + canonical hash 缓存；文本条件只允许安全 LIKE（转义 %/_）或可选 FTS5，禁止任意正则/SQL 注入。负载测试目标 10万～50万真实索引（本地 NVMe 和 NAS，查询始终本地 SQLite），P95 目标视硬件衡量，出现超时必须显示可恢复错误而不是卡死。

参考：
- Adobe Lightroom Classic Metadata filters: https://helpx.adobe.com/il_en/lightroom-classic/desktop/organize-photos-in-lightroom-classic/metadata-filters-in-lightroom-classic.html
- Adobe Lightroom Classic Smart collections: https://helpx.adobe.com/in/lightroom-classic/help/photo-collections.html

## 8. 筛选验收用例

1. 列 A 选 2024/2025（OR），列 B 选 Sony/OM（OR）与 RAW 列（AND），结果与 SQL 查询一致。
2. 列自排除 facet 对已选机身仍显示可选其他机身的有效计数；全部筛选结果数不能和自排除列计数混用。
3. 选中后计数变 0 不自动清除选项；无效值/无数据字段可恢复显示。
4. 高级 (A OR B) AND (ISO>=1600) AND NOT(missing lens) 与逻辑拍摄和物理文件两种口径正确。
5. NOT(ISO>=1600) 对 NULL 的补集语义准确；ISO<1600 对 NULL 不命中；is_missing 能单独命中。
6. 相同拍摄 RAW+JPEG 计 1 capture；file scope 同时含 2 文件，跨文件属性要求相同物理文件时 file_any 内绑定。
7. 加载预设、浏览器前进后退、切换模式、移动端多列切换不丢失嵌套规则。
8. 图表/排行榜/明细/导出在相同 snapshot + AST 下统计相同数量；仅排行聚合按器材匹配规则排除歧义。
9. 尝试注入字段名、任意 operator、任意 JSON path、过深规则、过长字符串返回 422，未形成动态原始 SQL。
10. 仅查询/分面/保存预设/导出/浏览排行触发零次源目录 stat/scandir/open/ExifTool。
11. 深色/浅色、缩减动画、鼠标/键盘/触控、屏幕阅读器语义与 320px 小屏可用。
12. 不出现 GPS 字段、选项、空间统计或意外从原始 EXIF 搜索中索引位置信息。
