# 格式兼容、元数据规范、设备识别

## 1. 格式策略与证据

采用 ExifTool 的**可识别文件类型**作为主要元数据能力底座；文件格式支持不等于字段齐全、不等于能显示预览、不等于能完整解码像素。正式实现应固定并记录 ExifTool 版本，以真实样本运行兼容性回归；详见官方文档 https://exiftool.org/exiftool_pod2.html 与项目 https://github.com/exiftool/exiftool 。

| 类别 | 扩展名（大小写不敏感） | 与历史器材/扩展的关系 |
|---|---|---|
| Sony RAW | .arw, .sr2, .srf | Sony A7/A7C/A7M 系列 |
| Fujifilm RAW | .raf | X100V、X-T、X-Pro、X-H |
| Olympus/OM RAW | .orf, .ori | E-P7、OM-5、E-M |
| Nikon RAW | .nef, .nrw | Z fc 等 |
| Panasonic/Leica RAW | .rw2, .rwl | S9、GX9、D-Lux 等，具体相机仍以真实文件为准 |
| Adobe/DJI/Pentax/Ricoh/Leica RAW | .dng, .pef | DNG 家族及厂商 RAW；不强制所有机型产生两种文件 |
| Canon RAW | .cr2, .cr3, .crw | 通用兼容，即使历史档案未出现 |
| GoPro RAW | .gpr | 运动相机静态 RAW，需按真实机型/模式测试 |
| 其他典型 RAW | .3fr, .fff, .iiq, .erf, .kdc, .dcr, .mrw, .mos, .raw, .srw, .x3f, .mef | 长尾格式，列为候选并逐版本回归 |
| JPEG | .jpg, .jpeg, .jpe | 最常见静态照片 |
| HEIF | .heic, .heif, .hif | Apple/相机 HEIF 族；ExifTool 可提取的标签依设备而异 |
| 其他静态照片 | .tif, .tiff, .png, .webp, .avif, .jxl | 可读元数据时进入统计，但非全部都有拍摄 EXIF |
| 运动/全景特定图片（实验性） | .insp | Insta360 特定静态图片仅尽力提取，格式能力和准确性需样本确认 |

不扫描 .insv、.mp4、.mov 等视频（可 P2 另立“视频资料”规范）；不将 .xmp/.aae 侧车文件计作拍摄张数，后续可按明确开关做只读侧车关联；不将 .lrprev、缩略图缓存等默认计作主文件。对任何扩展不从 JPEG/HEIF 的可读取性推定 RAW 可拍摄能力。例如 Fujifilm X-Half 的用户历史评价写明“无 RAW”，只能按实际有的 JPEG 统计。

扫描范围由以上“文件扩展名白名单”+ 显式 include/exclude patterns 决定；pattern 更改会触发下一次手动扫描重新评估已存在索引，但不自动读取源目录。允许不在清单中的 RAW 通过版本化白名单扩展，归类 unknown/raw_candidate，不能仅靠后缀假定一定是有效 RAW。

## 2. 原始标签与统一字段并存

ExifTool 必须保留原始 namespace/tag/source provenance、重复标签可能性（例如 -a -G1 -s -n JSON），还要将高频字段规范化为稳定的类型化 Schema。原始标签字典按文件压缩存储（推荐 zlib；新增 zstandard 可选）、默认上限 1 MiB/文件，超限标记 truncated，不能静默截掉统计必需字段。

每个标准字段必须记录 source_tag、unit、parse_status（present/missing/invalid/inferred）。重要字段：

| 组别 | 统一字段 | 说明 |
|---|---|---|
| 文件 | relative_path, basename, extension, detected_format, mime, size_bytes, mtime_ns, hash_optional | 文件系统值与格式探测值分离 |
| 时间 | capture_at_local, timezone_offset, capture_at_utc, capture_precision, capture_time_source | EXIF 日期通常没有时区；不可凭空猜 UTC |
| 相机 | make_raw, model_raw, serial_raw_optional, make_norm, model_norm, firmware, camera_type | 不自动把“机身记录”的 purchase_date 当拍摄日期 |
| 镜头 | lens_make_raw, lens_model_raw, lens_id, focal_mm, focal_35mm_mm, digital_zoom | 35mm 等效值只有元数据或可靠机型倍率才计算 |
| 曝光 | iso, exposure_s, f_number, exposure_comp_ev, exposure_program, metering_mode, flash | exposure_s 作为数值秒保存，UI 才格式化 1/250 s |
| 传感与输出 | width_px, height_px, orientation, color_space, bit_depth_optional, raw_bit_depth_optional, compression, crop_factor_optional | 分辨率区分传感器与输出尺寸 |
| 高级曝光 | shutter_type, focus_mode, af_area, stabilization, burst_mode, white_balance, creative_filter, picture_profile | 所有厂商 MakerNotes 都须 optional + provenance |
| 空间 | gps_lat, gps_lon, gps_alt_m, gps_timestamp, gps_source | 按精度保留；默认导出脱敏 |
| 归类 | media_role(raw/jpeg/heif/other), capture_group_id, match_confidence, parser_name, parser_version | 不能以 JPEG 数替代逻辑拍摄数 |

数值约束：ISO >= 0，曝光时间 > 0，光圈 f_number > 0，焦距单位 mm，时间戳携带“是否可靠时区”标志；无值用 NULL，不使用 0 或字符串 unknown 冒充有效 EXIF。格式标签 ISO 为列表、分数、文本时要先做类型化解析，无法解析保留原始值与错误信息。高度宽度方向须结合 Orientation 区分像素宽高和展示旋转。

时间回退优先级：SubSecDateTimeOriginal / DateTimeOriginal + OffsetTimeOriginal > CreateDate + 明确偏移 > EXIF DateTimeOriginal 无时区 > FileModifyDate（仅作近似，并标记 filesystem_fallback）。不同相机时区设置、夏令时、同步时间误差不得自动“纠正”历史照片；跨时区统计需显式选择“拍摄本地日历”或“已知 UTC”。

## 3. EXIF 相机、镜头归一化和 Geargrade 关联

建议三层表示：
1. observed：原始 Make/Model/LensModel 标签，永不覆盖。
2. canonical：品牌大写小写/空白/常见 EXIF 型号前缀消歧后的稳定 key，例如 sony:ilce-7c、fujifilm:x100v、nikon:z-fc。canonicals 需要表驱动/规则版本。
3. Geargrade asset：指向历史 Device 的可选设备档案 id（存在多次购入同机型时，不自动任取一次）。

绑定策略：
- EXACT_EXIF_CANONICAL：已知别名且无歧义，自动关联“型号”；若 Geargrade 有重复购入，关联到型号族而不是默认某一轮次。
- CAMERA_LENS_MATCH：镜头通过 LensModel+LensID/品牌精确判定；无法确证时只展示观察值，标记未绑定。
- USER_CONFIRMED：在设置页人工指定 Geargrade 记录或“只绑定型号，不绑定轮次”，优先级最高，允许撤销。
- SUGGESTED：字符串/相似度候选只提示而不静默更新正式关联（例如镜头别名与套头混淆）；purchase_date/sale_date 只作为人类辅助信息，不能构成绝对物理证据。

具体首批回归 alias：A7C / ILCE-7C；Z fc / NIKON Z fc；X100V / X100V (B)。注意数据库中的 “Fujifilme” 为用户录入拼写，与官方 ExifTool Make 值不可简单视为另一品牌。格式候选映射是按厂家家族推测，不是声明这些设备已经拍出相应文件。

## 4. RAW+JPEG、连拍、多尺寸、全景照片

photo_files 代表**物理照片文件**，photo_captures 代表**尽最大可能还原的一次快门/逻辑拍摄**。默认优先在同一 source / 同一相对目录、相同或符合相机命名规则的 stem、拍摄时间差不超过可配置容差（默认 2 秒）、相机身份一致时将 RAW+JPEG/HEIF 合为一组。相同时间戳不同文件号不能合并，连拍保持不同 capture；不同来源或目录不直接合并。没有可靠时间、命名不明确则各自成组，展示“分组置信度低”。

多帧机内超解析、HDR、全景、相机插件派生文件、编辑导出 TIFF、DSC_1234(1) 等默认不视为同一快门；仅在具备确定性规则/sidecar 证据时允许显式绑定。统计必须在 UI 上区分“物理文件量”“逻辑拍摄数”“RAW/JPEG 对数”“派生文件”，并提供按文件模式的对照。

原始照片无需可预览才可记录 EXIF；完全不生成缩略图属于第一版默认。任何日后添加缩略图均需要单独安全与存储规范，且缩略图仅能写 app data 缓存，不得写入来源。