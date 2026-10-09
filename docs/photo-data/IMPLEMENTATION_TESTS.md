# 实施计划、测试矩阵和验收门槛

## 1. 开发阶段（不创建分支；向 main 修改前先审阅）

P0-A：数据库与安全底座
- 读写分离：photo_index.db 建库和迁移；含 sources、files、metadata、scan_runs、errors、可见 generation。
- Compose 可选只读卷示例与环境变量；系统 ExifTool 安装和固定版本记录。
- 扫描目录 allowlist、路径规范化、不跟随 symlink、只读打开、单任务互斥、鉴权/受限部署说明。
- 在设置页实现来源名称、容器内路径、开启/停用、过滤规则，仅持久化，不读文件系统。

P0-B：扫描完整闭环
- Scan job：手动开始、查状态、取消；ExifTool 常驻批量进程与超时恢复；增量比较；staging -> atomic publish。
- 只有成功可枚举的来源才完成删除 reconciler；30 天墓碑留存策略；partial/cancelled/interrupted 不发布污染快照。
- 明确日志字段和可重试解析错误；首次与重复扫描进度 UI。

P0-C：基础可视化与导出
- /photo-data 顶栏与路由；上次成功时间、格式/日期/机身统计、物理文件表；优先实现 Lightroom 式可配置动态列（默认四列、同列 OR / 跨列 AND）、自排除分面与字段注册表，筛选 API 服务端聚合。
- CSV.zip + JSONL.gz + summary.json 导出；manifest schema / 隐私默认脱敏。
- 维护现有 GGPack v1 兼容行为、原有数据工具重置行为和移动端风格。

P1：完整器材行为分析
- EXIF/器材 canonical alias 表、人工确认、跨库软关联；RAW+JPEG 合并捕获与冲突检测；高级嵌套 AND/OR/NOT 筛选规则与保存预设；在原排行榜添加第四个「拍摄使用量榜」，涵盖机身/镜头、已售设备、未关联型号和真实逻辑拍摄数；全局统计、镜头/曝光联合图和错误诊断。
- 对当前历史 GGPack 中覆盖的机身家族制作样本回归清单，特别是 X100V、A7C/ILCE-7C、OM-5/E-P7、Nikon Z fc、DJI/Insta360/GoPro 等。

P2：高级分析与容量优化
- MakerNotes 专业字段按厂商增强（不含 GPS/位置标签）；聚合缓存/统计加速、可靠内容哈希辅助去重（默认关闭）、ExifTool 升级回归。
- 每个阶段单独附迁移回滚脚本与用户数据保护说明。不得为了进度降低 P0 的只读和删旧保护等级。

## 2. 自动化测试矩阵

| 测试层 | 具体测试 | 验收标准 |
|---|---|---|
| 安全与触发 | 保存/修改/查询来源、登录页/设置页、查询图表、生成导出、重启后台 | 对源挂载的 stat/scandir/open 调用次数均为 0 |
| Docker 只读 | 挂载后 ExifTool、API 任意操作；容器以非 root 执行 | 原始文件内容/mtime 不改变；不可写源挂载 |
| 文件范围 | allowlist 越界、../、符号链接循环、根内符号链接跨盘、恶意替换目录 | 拒绝或跳过，记录明确失败；不会逃逸允许根目录 |
| 增量 | 一次 1000 文件初扫、立即重扫、替换 1 个、加入 1 个、删除 1 个 | 重扫 EXIF 解析数为 0；更改扫描只解析 2 项；删除软删除 1 项 |
| 删除保护 | NAS 断开、EACCES、半途 I/O 错误、取消、服务重启、海量删除阈值 | 旧的已发布活跃索引数不减少，源故障不“清空图库” |
| 原子可见 | 首扫中途失败、升级 parser 中途失败、分页读写并发 | 正式统计只展示最后一次已发布成功快照 |
| 格式 | 真实小型样本矩阵：ARW/RAF/ORF/NEF/RW2/DNG/PEF/GPR/JPG/HEIC 与坏文件 | 可读文件提取对应真实字段；无法读取的文件保留索引+错误，不使作业崩溃 |
| RAW+JPEG | 同 stem/目录/机身/时间、多次连拍、多目录同名、相似文件名 | 同拍合并、连拍不合并，遇歧义保留独立并标低置信度 |
| 型号归一化 | A7C/ILCE-7C、Z fc 命名、X100V 别名、购买轮次重复 | 同型聚合正确；单次购入归属没有证据时不自动确定 |
| EXIF 精度 | 无时区、无 DateTimeOriginal、错误分数快门、0 ISO、旋转、缺失焦距 | fallback 明确，NULL 不伪造，单位统一 |
| 多列/高级筛选 | 自排除 facets、同列 OR 跨列 AND、嵌套 NOT、NULL、文件与拍摄口径、预设升级、前进后退 | 与 [FILTER_INTERACTIONS.md](FILTER_INTERACTIONS.md) AST 语义及十余场景一致，无动态 SQL 注入风险 |
| 摄影使用量榜 | 机身/镜头型号、同型多次购入、售出、未匹配、RAW+JPEG、连拍、年月范围 | 与 [USAGE_LEADERBOARD.md](USAGE_LEADERBOARD.md) 统计一致，已售设备仍上榜，未知不误绑定 |
| 图表/导出 | 多条件筛选、时区、照片文件数/拍摄数、无 GPS、空库、敏感元数据 | 统计口径一致，JSONL 可逐行解析；不保存/导出 GPS/位置数据且默认去除绝对路径/serial |
| 原功能回归 | 设备/心愿池 CRUD、旧 GGPack 导入导出、现有重置、排行榜、页面导航 | 原功能和数据库不回归 |
| 性能 | 1万 / 10万 / 50万规模，本地 NVMe 与 NAS，首次和重复扫描、1% 变化 | 报告真实环境及速度/内存/错误率；不得依赖固定超时拍脑袋推定达标 |

## 3. 功能验收 Checklist

- [ ] 顶部新增“拍摄数据”Tab，设置新增“拍摄数据源”区域。
- [ ] 文本保存目录绝不打开目录；无需手动扫描前允许访问旧索引统计。
- [ ] 一个实例同一时刻最多一个扫描；支持状态、取消、历史记录与上次成功时间。
- [ ] 支持主要 RAW/JPEG/HEIF 家族，包含失败记录与原始 EXIF 可追溯。
- [ ] 新增/修改跳过未变化文件；成功完整扫描才执行缺失清理；墓碑可恢复。
- [ ] 断线/权限异常/取消/重启不清理旧数据，不发布不完整统计快照。
- [ ] 物理文件、逻辑拍摄、RAW+JPEG、目录容量的口径清晰独立。
- [ ] 摄影机/镜头别名可识别，不因重复购买自动误关联轮次。
- [ ] 图表可联动过滤、服务端聚合/分页，宽窄屏与深浅模式兼容。
- [ ] Lightroom 式动态多列筛选、自排除 Facet、嵌套布尔规则、字段类型与 NULL 运算、可保存预设，并复用同一 AST 驱动图表/导出/排行。
- [ ] 新增「拍摄使用量榜」作为现有排行榜第四个 Tab，机身与镜头两套排名，按真实逻辑快门次数、含已售设备与未绑定型号。
- [ ] 导出 geargrade.photo-data.v1 并默认脱敏，旧 GGPack v1 不变。
- [ ] Docker 源挂载只读、DB 在本地卷、路径安全测试通过。
- [ ] 交付 README、部署示例、API Schema、迁移文档、基准报告与失败恢复手册。

## 4. 决策记录

- ADR-001：SQLite 独立照片索引，而非 PostgreSQL/Elasticsearch；理由：本项目当前单容器本地 SQLite 架构与个人/家庭图库规模。
- ADR-002：ExifTool 原生后端批量只读读取；理由：广泛 RAW 支持、MakerNotes 丰富度、可追溯底层 tags。
- ADR-003：只有按钮触发扫描；理由：NAS 能耗/隐私/用户明确的访问控制。
- ADR-004：完全遍历 + 轻量 stat 增量 + 不变文件跳过 EXIF；理由：避免对 NAS 扫全量 RAW 内容。
- ADR-005：删旧只在成功完整枚举时发布；理由：避免挂载消失导致历史库误删。
- ADR-006：独立导出协议；理由：摄影索引远大于器材档案数据且原 GGPack 合同已稳定。
- ADR-007：物理文件与逻辑拍摄分离；理由：RAW+JPEG、连拍、编辑导出与跨目录复制。
- ADR-008：默认不做像素解码/缩略图；理由：本需求是拍摄数据分析，不是原片浏览。
- ADR-009：复用 Lightroom Classic 风格动态多列筛选 + 高级条件 AST，所有统计和榜单从唯一语义层查询，避免计算口径漂移。
- ADR-010：现有排行榜新增拍摄使用量榜，优先按逻辑拍摄次数聚合型号，未可靠识别的购买轮次不自动归属。
- ADR-011：完全禁用 GPS/位置元数据（含原始标签与导出）；理由：产品明确不需要地理分析，减少隐私负担。

## 5. 技术参照

- ExifTool 官方受支持文件类型与命令参数：https://exiftool.org/exiftool_pod2.html
- ExifTool GitHub：https://github.com/exiftool/exiftool
- SQLite WAL：https://sqlite.org/wal.html
- Geargrade 当前工程：backend/app/main.py、backend/app/db/、backend/app/services/data_service.py、frontend/src/routes/AppRouter.tsx、frontend/src/components/layout/AppShell.tsx、frontend/src/pages/SettingsPage.tsx、docker-compose.yml。

**状态更新（1.0.0）**：基本扫描器、SQLite、REST API、页面、排行榜、进度与初步高级筛选已实现；本文件中尚未满足的全部验收条目继续保留为后续工作。已加入 GitHub Actions CI 与 10,000 文件模拟压力测试，但真实 RAW/NAS 性能和厂商 MakerNotes 仍需实物验证。