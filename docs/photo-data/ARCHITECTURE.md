# 架构与安全边界

## 1. 现状与选型

以仓库 main 现有代码为准：前端 React 18 + TypeScript + Vite + TailwindCSS + Recharts；后端 FastAPI 0.115 + SQLAlchemy 2.0 + Python 3.12；数据库 SQLite；Docker Compose 单应用容器，应用的当前配置包含 geargrade_data、geargrade_media 两个卷，默认 geargrade.db。原来的 AppSettings 使用单例表，数据工具 GGPack v1 只覆盖 devices 和 wishlist。

推荐模块**沿用现有栈**，不新增数据库服务或定时任务。元数据读取首选系统 ExifTool，通过受控的子进程池批量只读解析；Python 负责可靠遍历、清洗、批量 upsert；FastAPI 暴露后台扫描作业 API；前端沿用 Recharts 图表。为降低对设备 CRUD 的干扰，新增 /app/data/photo_index.db（SQLite 独立文件；可共享现有 geargrade_data 卷），不要在原 geargrade.db 里堆积完整 RAW MakerNotes JSON。通过 device_id 软关联主数据库记录，跨 DB 不建立真实外键。

目标模块目录（实施时创建）：

~~~text
backend/app/photo_data/
  config.py, models.py, schemas.py, db.py
  metadata.py, normalization.py, identity.py, scanning.py
  statistics.py, exports.py, jobs.py, security.py
backend/app/api/routes/photo_data.py
frontend/src/pages/PhotoDataPage.tsx
frontend/src/components/photo-data/
frontend/src/api/photo-data.ts
frontend/src/types/photo-data.ts
backend/tests/photo_data/
~~~

## 2. Docker 宿主目录挂载与设置契约

部署方显式配置只读挂载，例如可选叠加 Compose 文件，避免在主 compose 无路径配置时阻止老用户启动：

~~~yaml
services:
  app:
    volumes:
      - /host/photography:/mnt/photo-library:ro
    environment:
      PHOTO_DATA_ALLOWED_ROOTS: /mnt/photo-library
      PHOTO_DATA_DB_URL: sqlite:////app/data/photo_index.db
~~~

注意这段仅是**增量配置范例**，需叠加于现有 app 服务和卷，不能代替原 compose。NAS 可经主机 NFS/SMB 挂载再 bind 到容器。SQLite 数据库应在**可靠的容器本地卷**，不应与网络摄影源目录共置。SQLite WAL 多读单写适合此场景，但官方明确 WAL 不适用于跨主机的网络文件系统；详见 https://sqlite.org/wal.html 。

前端“设置 > 拍摄数据源”填写的是**容器内可见路径**，不是浏览器电脑磁盘路径，也不会把宿主机路径隐式挂到容器。设置页仅做字符串合法性及已配置 allowlist 的词法约束；不执行 stat、realpath、目录列举或探测。只有点击“扫描更新”才执行物理路径检查（open/scandir/fstat）；除扫描任务本身外，不提供浏览文件夹的 API。

## 3. 路径和进程安全

- PHOTO_DATA_ALLOWED_ROOTS 由管理员环境变量定义；不允许 API 提交任意宿主机绝对路径或修改 allowlist。
- 配置目录必须位于 allowlist 内；做词法路径归一化，拒绝 ../、NUL、相对路径、保留目录（/app/data、数据库、/proc、/sys 等）及与其他数据源重复或嵌套的路径。
- 开始扫描时，以根路径固定的目录 fd / no-follow 方式验证并访问。默认**不跟随符号链接**，避免越界、循环和“目录被替换”造成的竞态风险；新建文件时目录 fd 与实际打开路径须同属受控根。若 Linux openat2 可用可使用 RESOLVE_BENEATH / NO_SYMLINKS 等机制；兼容回退仍须有明确的路径校验与测试。
- 如果只能实现有 TOCTOU 窗口的路径校验，不得宣称完全防止恶意并发替换；必须在部署指南声明“仅限信任的本机图库挂载”这一威胁边界。
- 后端 ExifTool 命令固定只读参数，严格禁止 -overwrite_original、-tagsfromfile、重命名、写文件、sidecar 输出；用户输入不组成 shell 命令；文件名经 argv 或受控 argfile 传入。
- 照片内容既不由静态资源端点公开，也不经 API 原样下载；只读挂载无论软件权限如何均作为额外防线。
- API 写入扫描配置和启动作业属于管理员操作；当前 Geargrade 尚无认证边界，暴露公网前需增加管理认证或限制 LAN / 反向代理访问。跨域 CORS 现状较宽松，正式实施须复核 mutating endpoint 的跨站防护。
- 严格不索引 GPS 或任何位置元数据；原始 ExifTool/MakerNotes JSON 必须入库前做位置字段清洗，不提供地理搜索/地图/导出。机身序列号与精确路径是隐私数据；导出默认脱敏，只有审查后的非位置信息原始标签可作为可选字段保留。

## 4. 数据库模型

使用单独的 photo_index.db；SQLAlchemy 2.0 ORM + 版本化显式迁移，不能仅依赖 Base.metadata.create_all 来演进生产表。以下为逻辑表定义，字段类型以迁移和 Schema 为准：

| 表 | 关键字段 | 用途 |
|---|---|---|
| photo_sources | id(UUID), name, root_path, enabled, created_at, last_attempt_at, last_successful_scan_at, last_success_generation | 只保存配置，无添加即扫描 |
| photo_scan_runs | id, source_id, generation, state, started_at, completed_at, files_seen, candidates, created, changed, unchanged, missing, parse_failed, directories_failed, error_code, error_summary | 手动作业审计 |
| photo_files | id, source_id, relative_path, extension, format_family, size_bytes, mtime_ns, ctime_ns?, inode?, file_fingerprint, last_seen_generation, first_seen_at, indexed_at, parse_status, is_present, removed_at, exif_extracted_at, metadata_version | 物理文件唯一索引 |
| photo_metadata | photo_file_id(PK), capture_at_local, utc_offset_minutes?, capture_at_utc?, capture_time_source, make_raw, model_raw, make_norm, model_norm, lens_raw, lens_norm, serial_hash?, iso, exposure_s, f_number, focal_mm, focal_35mm_mm?, width_px?, height_px?, orientation?, exposure_comp_ev?, wb?, flash?, raw_json_zlib?, raw_json_truncated | 统一字段 + 原始标签压缩存档 |
| photo_captures | id, source_id, capture_key, representative_file_id, captured_at, model_norm, grouping_confidence, created_at | 逻辑拍摄实体 |
| photo_capture_files | capture_id, photo_file_id, role(raw/jpeg/heif/other), PRIMARY KEY(capture_id, photo_file_id) | RAW+JPEG 等同一次拍摄 |
| photo_device_aliases | id, kind(camera/lens), observed_make, observed_model, normalized_key, device_id?, match_method, confidence, manually_confirmed, updated_at | 型号对照和人工绑定 |
| photo_file_errors | id, file_id?, scan_run_id, relative_path, stage, code, description, occurred_at | 每次解析/访问失败快照 |
| photo_filter_presets | id, name, filter_schema_version, ast_json, columns_json, owner_scope?, created_at, updated_at | Lightroom 多列/高级规则预设，不访问源目录 |
| photo_query_cache（可选） | snapshot_id, filter_hash, response_kind, result_json, computed_at | 分面与聚合查询缓存；快照发布/别名变更后失效 |

约束与索引：

- UNIQUE(source_id, relative_path)，所有 relative_path 使用根下标准 POSIX 相对路径，保留实际大小写；不通过 basename 判定同一文件。
- INDEX(source_id, is_present, last_seen_generation) 支撑删旧；INDEX(source_id, mtime_ns, size_bytes) 支撑候选比较；INDEX(photo_metadata.capture_at_utc)、(model_norm, capture_at_utc)、(lens_norm, capture_at_utc) 支撑时间/设备图表；UNIQUE(source_id, capture_key)。
- 外键 pragma foreign_keys=ON；WAL、busy_timeout、事务批处理；scan writer 单进程排他，API analytics 用短只读事务。
- 经过**位置字段彻底移除**的 JSON/扩展 MakerNotes 可按 photo_file_id 压缩保存；对可统计的常用字段建立类型化列，并维护字段白名单注册表与必要 SQL / facet 索引，避免每次图表重复反序列化。动态筛选一律服务端 AST 白名单编译，无原始 SQL 输入。
- 为拍摄使用量榜提供 canonical 型号聚合能力；跨数据库设备 ID 允许为 NULL，重复购入不得自动绑定某一个轮次。榜单接口设计见 [USAGE_LEADERBOARD.md](USAGE_LEADERBOARD.md)。
- DB 迁移有 schema_migrations 版本表、备份与失败回滚；现有数据工具的“重置所有数据”默认**不得**清除摄影索引，必须增加独立确认后才允许重置该索引。

## 5. 并发与故障容忍

一个实例全局至多一个 scan job；首次版本一个 ExifTool 常驻子进程、可调小批量并行，但写库串行。单次扫描单独分配 generation。App 重启后 RUNNING 视为 INTERRUPTED（只能更改本地作业表），**不自动访问源目录恢复**；仍可读取上次成功快照。删除来源配置默认仅解除挂载索引入口，保留既有数据直至明确选择“移除来源及其索引”并二次确认，此清理仅发生于数据库内。

镜头/机身设备 CRUD 与扫描索引互不阻塞；跨数据库关联通过对应 device_id 软引用，删除设备后保留 EXIF 原始机型并显示“未关联”。