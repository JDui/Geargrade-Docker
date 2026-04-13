# Geargrade

Geargrade 是一个面向个人摄影器材管理的自托管 Web 应用。它的重点不是通用库存，而是“设备档案 + 持有状态 + 主观评价 + 买卖记录”。

## 技术栈

- 前端：React + TypeScript + Vite + Tailwind CSS
- 后端：FastAPI + SQLAlchemy
- 数据库：SQLite
- 部署：Docker Compose

## 当前能力

- 设备增删改查
- 深色 / 亮色主题切换
- 顶栏全局统计：当前持有、已售设备、正在感受
- Dashboard 可视化概览
- 评价等级分布
- 设备类别分布
- 年度购买量统计（排除配件）
- 当前持有设备快捷面板
- 卡片视图 / 表格视图切换
- 表格表头排序
- 关键词、类别、状态、评价、购入年份筛选
- 设备详情右侧抽屉
- 数字评分映射评价体系
- `score = -1` 表示“正在感受”
- 第几次购入的角标展示
- 排行榜页面：持有时间榜、评分榜、理财榜
- 榜单切换与升降序切换
- 结构化 JSON 导入 / 导出
- 本地图片上传
- 远程图片 URL 下载缓存
- 示例数据自动初始化

## 页面截图

以下截图通过本地无头浏览器静默生成，保存在 `docs/screenshots/`。

### 首页总览

首页展示当前持有、已售和正在感受的全局统计，以及评价等级分布、设备类别分布、年度购买量和设备库筛选区。

![首页总览](docs/screenshots/dashboard-home.png)

### 设备详情抽屉

详情抽屉展示设备基础信息、评分榜名次、数字评分主视觉卡、优缺点和财务时间记录，适合在不离开列表页的情况下快速查看完整档案。

![设备详情抽屉](docs/screenshots/device-detail-drawer.png)

### 排行榜

排行榜页面支持评分榜、持有时间榜和理财榜切换，并突出展示 Top 3 的 podium 卡片和完整排名列表。

![排行榜](docs/screenshots/leaderboards-score.png)

### 数据工具

数据工具页用于导出当前数据、导入结构化 JSON，以及配合模板批量整理设备档案。

![数据工具](docs/screenshots/data-tools.png)

### 新增设备

新增设备页支持录入品牌、类别、卡口系统、数字评分、购入次数、详细评价、价格与图片来源。

![新增设备](docs/screenshots/device-form.png)

## 项目目录

```text
backend/   FastAPI + SQLAlchemy API
frontend/  React + Vite 界面
templates/ 导入模板与示例数据
docs/      文档与页面截图
```

源码保持前后端分离；运行时合并为单容器，由 FastAPI 同时提供 API、媒体文件和前端打包后的静态资源。

## 本地开发

### 后端

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Windows PowerShell：

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

默认开发地址：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:8000`

## Docker 一键启动

1. 复制环境变量文件：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

2. 启动服务：

```bash
docker compose up -d --build
```

3. 打开：

```text
http://localhost:8080
```

## 环境变量

`.env.example` 提供了默认配置：

- `DATABASE_URL`：SQLite 数据库位置
- `MEDIA_ROOT`：图片缓存目录
- `MEDIA_URL_PREFIX`：媒体公开路径
- `SEED_SAMPLE_DATA`：首次启动时自动注入示例数据
- `APP_ENV`：运行环境标记

## 数据与媒体持久化

Docker Compose 运行时使用一个应用容器和两个命名卷：

- `geargrade-app`：唯一运行容器，内部同时承载 FastAPI 和前端静态资源
- `geargrade_data`：SQLite 数据文件
- `geargrade_media`：上传图片和远程缓存图片

## API 概览

- `GET /api/v1/health`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/devices`
- `GET /api/v1/devices/{id}`
- `POST /api/v1/devices`
- `PATCH /api/v1/devices/{id}`
- `DELETE /api/v1/devices/{id}`
- `GET /api/v1/leaderboards/holding-duration`
- `GET /api/v1/leaderboards/score`
- `GET /api/v1/leaderboards/finance`
- `GET /api/v1/data/export`
- `POST /api/v1/data/import`
- `POST /api/v1/media/upload`
- `POST /api/v1/media/cache-remote`
- `POST /api/v1/bootstrap/sample-data`

## 评分与状态规则

- `score = -1`：正在感受，不参与评级分布和评分榜
- `score = 0-49`：低
- `score = 50-79`：中规中矩
- `score = 80-100`：极佳
- `score > 100`：神
- `holding` / `for_sale`：自动清空售出价格和售出日期
- `broken`：售出价格自动记为 `0`，售出日期为空
- 状态枚举仅包含：`holding`、`for_sale`、`sold`、`broken`

## 导入导出

- 导出接口返回结构化 JSON，可直接再次导入
- 导入接口采用“先去重，再追加”
- 去重键：`brand + name + acquisition_iteration + purchase_date`
- 模板文件：
  - `templates/device-import.template.json`
  - `templates/device-import.example.json`

## 测试

后端：

```bash
cd backend
pytest
```

前端：

```bash
cd frontend
npm test
```

## 后续扩展方向

- 时间线视图
- 价格波动记录
- 多图管理
- 导出 / 备份增强
