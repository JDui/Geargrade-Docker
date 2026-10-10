# 更新记录

## 2026-10-10：v1.0.2

- 新增机身与镜头年度前十更替图，逐年独立排名，保留筛选入口并兼容旧服务。
- ISO 与等效焦距分布使用单调平滑曲线，保留原始数据点、读数和筛选值。
- 更新部署镜像标签为 `geargrade-docker-app:1.0.2`，本地 AMD64 离线包为 `dist/geargrade-v1.0.2-linux-amd64.tar`。

## 2026-10-10：v1.0.1

- 照片明细移至数据工具并默认折叠，保留搜索、元数据查看、导出和筛选链接。
- 优化器材排行、年度图和曝光参数分布，支持点击统计结果筛选照片。
- 顶栏及概览「正在感受」入口可跳转至对应筛选档案。
- 更新部署默认镜像标签为 `geargrade-docker-app:1.0.1`；AMD64 离线包保存在 `dist/geargrade-v1.0.1-linux-amd64.tar`。
- 本地离线包不纳入 Git；保留常用依赖、基础镜像和依赖缓存，直至明确要求删除。

### v1.0.1 本地构建与验证

- 源码提交：`65ad6f72f65efdc62d41d20bea17efeebf50e0a7`
- 平台：`linux/amd64`
- 镜像：`geargrade-docker-app:1.0.1`
- 文件：`dist/geargrade-v1.0.1-linux-amd64.tar`（83,987,968 字节，约 80 MB）
- SHA-256：`d180be89263d3c31835664c16358297e3426352f9ec8c665a88ccf3f50dab0b9`
- 验证：前端 60 项、后端 44 项测试通过；镜像导入、版本/架构标签、服务启动、健康接口、前端页面和 ExifTool 检查通过。
- 前端依赖审计仍报告 15 项漏洞（7 项中危、6 项高危、2 项严重），未升级依赖。

```bash
docker load -i geargrade-v1.0.1-linux-amd64.tar
```

## 2026-10-10：v1.0.0 AMD64 更新

源码基于 `main` 分支提交 `78c4c80c7cd48d34f16a1593389f123d277a746b`。

- 加入拍摄数据模块，手动扫描管理员配置的只读照片目录，并将 EXIF 索引保存在独立 SQLite 数据库中。
- 加入拍摄数据筛选、分析图表、相机与镜头使用量榜，以及增量扫描进度展示。
- 修正动态筛选、多来源删除统计、失败照片重试和扫描取消状态等问题，完善图表动效与减少动态效果支持。
- 构建 `linux/amd64` Docker 镜像并导出离线归档，便于在无网络的部署主机上导入。
- 将 Python 运行时基础镜像固定为 `python:3.12-slim-bookworm`，保持 Python 3.12 并确保 Debian 包仓库签名可以正常验证。
- 前端静态资源在构建机原生架构上编译，避免 ARM 构建机通过 QEMU 执行 AMD64 Node 时崩溃；最终运行镜像仍为 AMD64。
- Docker 构建中的 `npm install` 报告 15 项依赖漏洞（7 项中危、6 项高危、2 项严重）；本次没有自动升级依赖。

### 离线镜像归档

- 平台：`linux/amd64`
- 镜像：`geargrade-docker-app:1.0.0`
- 文件：`dist/geargrade-v1.0.0-linux-amd64.tar`
- 大小：80 MB
- SHA-256：`2abed4649385f1f42ff4d7c014639c1a2fcd57165493d7712ea43aa496f1f0f4`

导入镜像：

```bash
docker load -i geargrade-v1.0.0-linux-amd64.tar
```

完整功能说明及照片目录只读挂载方式见 [README](../README.md) 和[拍摄数据文档](photo-data/README.md)。
