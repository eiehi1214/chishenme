# 吃什么——校园 AI 智能就餐推荐助手

一个面向大学校园的智能就餐推荐系统，帮助学生解决"今天吃什么"的高频决策难题。

## 功能特性

**学生端**
- 登录 / 注册（学号身份）
- 首页时段感知推荐 + 今日热门榜 TOP5
- AI 助手对话选菜（规则式 NLU：意图识别 → 槽位解析 → 查库 → 话术生成）
- 发现页：按分类 / 关键词 / 价格筛选
- 个人中心：口味画像、历史记录、隐私与数据管理（可修改昵称、简介、账号密码）
- 菜品 1–5 星评分

**管理端**
- 数据统计看板
- 菜品增删改查与上下架
- 用户管理、评分与评论管理

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端 | 原生 HTML5 + CSS3 + JavaScript（单页应用，零框架依赖） |
| 后端 | Node.js 22 + Express.js |
| 数据库 | Node.js 内置 `node:sqlite`（零外部依赖） |
| 通信 | RESTful API（JSON + Token 认证） |

## 目录结构

```
吃什么全栈/
├── server.js            # 后端服务与 REST API
├── init_db.js           # 数据库初始化与种子数据
├── package.json
├── data/
│   └── chishenme.db     # SQLite 数据库文件
├── public/
│   ├── login.html       # 登录 / 注册页
│   ├── student.html     # 学生端
│   └── admin.html       # 管理端
├── start_backend.bat    # Windows 一键启动脚本
└── stop_backend.bat     # Windows 一键停止脚本
```

## 快速开始

### 环境要求
- Node.js 22 或更高版本（需支持内置 `node:sqlite` 模块）

### 安装与运行

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库（首次运行，或需要重置数据时执行）
node init_db.js

# 3. 启动服务
node --no-warnings server.js
```

服务启动后访问 http://localhost:3000

Windows 用户也可直接双击 `start_backend.bat` 一键启动（会自动打开浏览器）。

### 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 学生 | student | 123456 |

## API 概览

| 模块 | 端点 | 方法 |
|------|------|------|
| 认证 | `/api/auth/login` · `/register` · `/me` · `/update` | POST / GET / PUT |
| 菜品 | `/api/dishes` · `/hot` · `/:id` | GET / POST / PUT / DELETE |
| 分类 | `/api/categories` | GET |
| 评分 | `/api/ratings` | POST |
| 推荐 | `/api/recommendations/log` | POST |
| 统计 | `/api/admin/stats` | GET |

## 说明

本项目的 AI 对话能力由前端规则式 NLU 引擎实现（正则 + 关键词规则），
不依赖任何外部大模型 API，可离线运行。

## 许可证

本项目为课程设计作品，仅供学习交流使用。
