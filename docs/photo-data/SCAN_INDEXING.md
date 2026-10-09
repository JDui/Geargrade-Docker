# 手动扫描、增量索引和删除清理规范

## 1. 用户触发边界

只有 POST /api/v1/photo-data/scan（用户通过“扫描更新”按钮明确发起）允许访问扫描目录：preflight、scandir、stat、read、ExifTool 均属于该作业。此之外：不能因添加路径、刷新主页、启动容器、切换图表、导出、GET /status 或设备库变更而读源目录。无 watchdog/inotify、cron/APScheduler 和自动补扫。正在运行的作业可以持续执行；用户明确“取消”则请求受控停止。后端重启后绝不自动恢复；重新扫描须再次点击。

示例状态图：

~~~mermaid
stateDiagram-v2
  [*] --> idle
  idle --> queued: click Scan Update
  queued --> preflight
  preflight --> running: all roots ready
  preflight --> failed: root unavailable/unsafe
  running --> completing: enumeration successful
  running --> partial: IO or enumeration errors
  running --> cancelled: user requests cancel
  running --> interrupted: worker terminates
  completing --> completed: atomic missing-file reconciliation
  partial --> [*]: preserve prior active missing records
  completed --> [*]
  failed --> [*]
  cancelled --> [*]
  interrupted --> [*]
~~~

状态集 QUEUED, PREFLIGHT, RUNNING, COMPLETING, COMPLETED, PARTIAL, FAILED, CANCELLED, INTERRUPTED。前端同时显示“上次成功扫描”和“最近尝试”，不要将失败的尝试时间误写为成功时间。

## 2. 每次扫描具体算法

1. 接收指定 source_ids 或全部 enabled sources，服务器进行原子 job lock。返回 job_id；开始扫描后只允许任务执行器访问源。源目录在保存设置时并未探测。
2. PREFLIGHT 检查 allowlist/实际挂载/只读打开/根目录是否可枚举；不可访问直接 FAILED，**不产生文件缺失结论**。
3. 为每个 source 分配递增 generation。枚举符合允许格式的目录和文件；跳过符号链接，排除隐藏临时文件（规则可配置且可追溯），收集统计并批量入队；不根据目录 mtime 跳过整棵树，因为 NFS/SMB、拷贝工具和文件系统差异可能导致误判。
4. 使用 (source_id, relative_path) 查找已有记录；先比较 size_bytes + mtime_ns（支持平台精度），可选 inode/ctime 提高变化线索识别；未改变则更新 last_seen_generation，跳过 ExifTool，记为 unchanged。
5. 首见、大小/mtime 变动、上次失败、metadata_version 变化或用户手动“深度重扫”的候选进入 EXIF 队列。ExifTool 批量读取元数据，不做像素解码。对当前帧设置超时与输出体积限制；按文件记录错误、继续下一项。
6. 正常解析就更新 photo_files + photo_metadata；解析失败保留之前的有效 metadata，记录最新 parse_status/错误，不把该文件当成不存在；新文件失败仍保留物理索引以便重试。
7. 每 N 条（建议 250~1000）批量提交一次事务并报告进度。批处理中止后该 source 不满足“完整可删旧”的条件。
8. 全部**允许格式的文件枚举成功、所有子目录可访问且未取消**，才允许 COMPLETING 阶段在事务中对 last_seen_generation != generation 且 is_present=true 的记录软删除（is_present=false, removed_at=now）。**ExifTool 解析错误不等于枚举失败**；若有失败可将 run 归为 PARTIAL，策略是保守保留原有文件缺失状态，直到下一次完整成功扫描。
9. 完成后更新 last_successful_scan_at 和 last_success_generation，刷新聚合物化缓存（如启用）。文件软删除后即时不计入默认图表与导出，DB 中保留墓碑供诊断与可能恢复；默认 30 天后在**后续一次成功的手动扫描**中才批量物理清理 tombstones。删墓碑只影响索引，不触及照片。

**删旧不变量**：数据库中原有文件的任何“消失”结论只来源于相应 source 的一次完整且可信的目录枚举，不能来源于缺失挂载、IO 错误、任务取消或失败的扫描。

### 与网络卷有关的边界

- SMB/NFS 暂断、权限拒绝、目录变动（枚举过程中出现/消失）会导致 source 结果降级为 PARTIAL；保留旧记录，下一次用户手动扫描再判断。
- 遍历期间文件发生写入的“变化中”照片不做永久错误判断。读前/读后对比 stat，改变则标记 unstable，本轮保留旧元数据，下次手动重试。
- 确实已经清空且可枚举的目录会产生正确的删除标记，但 UI 在大量删除时应提示“本轮检测到大量缺失”并在完成原子提交前人工二次确认或按配置超过阈值标记 REVIEW_REQUIRED，防误挂载空目录。
- 对来源不同的目录不做跨 source 清理；一个 source 成功不意味着其他 source 成功。

## 3. 指纹、重命名与去重语义

轻量文件指纹 = (source_id, relative_path, size_bytes, mtime_ns[, inode])，是快速变化检测器，不是唯一内容 ID，也不是加密哈希。mtime + 大小都未变但内容替换可能漏检；提供手动“深度重扫”以重新提取，另可在高级模式对小样本抽查哈希。**禁止默认全库计算 SHA-256/MD5**，避免 RAW 文件反复从 NAS 读整份。

重命名/跨目录移动在第一版体现为“旧路径已删除 + 新路径新增”，逻辑拍摄可能得到新 ID。可选 P1 基于独立局部指纹或用户显式 full hash 做移动识别，绝不可把 hash 相同的两份真实照片直接合并物理文件统计。跨来源复制同样保持两个 photo_files 记录，另行计算“潜在重复”。

文件后缀只控制候选集；ExifTool 识别实际文件类型并将 extension 与 detected_format 分别记录。内容不匹配写 parse_error，不尝试覆写后缀。

## 4. 完整/中断对数据一致性的影响

- RUNNING 时已成功写入的新增/更新记录可见，但 run_id/generation 标记为 tentative；默认对外统计继续采用上次成功快照，避免前半目录已更新、后半目录未更新造成统计瞬间不一致。
- 推荐采用 generation/visible_generation 双版本快照或 staging changeset：扫描过程先写 staging（或标记不可见），COMPLETED 事务中发布本轮可见版本与删除 tombstones。PARTIAL/CANCELLED/INTERRUPTED 的待发布变动可清除或留作下次恢复候选，但**不能污染官方统计**。
- 若资源限制无法完整 staging，可选择维护最后成功版本的可见标志与版本化行，不能把不完整扫描展示为历史真实总量。
- 外部读请求采用本地 DB 已发布的最后成功 snapshot；无成功扫描时显示空态，而非宣称没有照片。
- SQLite WAL 与索引 DB 必须在本地/可靠的 app data 卷；不把 photo_index.db 置于只读媒体源路径。

## 5. 性能与资源治理

- ExifTool 常驻进程采用 -stay_open + -@ 和 -executeID，同步关联文件批次返回；参数仅允许读取 JSON、分组标签和数值字段。不启用 -b 大二进制缩略图、全原始影像解码。详见 https://exiftool.org/exiftool_pod2.html 。
- batch 提取与 upsert；限制文件枚举队列长度、进程数、每文件 EXIF 输出上限、单文件超时，避免恶意 MakerNotes 或坏文件造成内存泄漏；记录读取用时与失败原因。
- metadata_version 和 exiftool_version 保存到作业与/或每文件，升级解析器后自动**标记待重扫**但仍须用户点击按钮才执行。
- 允许按 source 单独扫描，在状态页查看扫描进度（已发现、已处理、已新增、已更改、未更改、失败、删除、每秒速率；总数可能未知）。SSE / 2s 轮询只读取 job 状态 DB/内存，不得读取源目录。
- 性能基准在 1万 / 10万 / 50万张、NVMe / SMB/NAS、第一次 / 重复 / 1% 变更情况下测量。目标：重复扫描 EXIF 提取量约等于需要更新的文件数；统计 P95 尽量低于 500ms（在说明硬件和数据规模的基准下测量），不得无依据承诺固定扫描总耗时。

## 6. 对抗性与回归测试

必须覆盖：只读目录、保存设置后零打开、列表查询零打开、重启零打开；更名、新增、删除、空目录、文件原地覆盖、mtime 精度、相同 basename 的不同路径、RAW+JPEG；扫描中断、取消、不可访问挂载、子目录 EACCES、半途断网、目录变动、内存限制、单文件超时；软删除恢复；阈值删除阻断、事务提交中途崩溃；双击按钮不得创建并行扫描。