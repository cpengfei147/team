# CQLens - AI 会议助手

实时语音转写和会议纪要生成工具。

## 功能

- 📱 移动端 Web 应用
- 🎤 实时语音转文字（讯飞 API）
- 📝 AI 会议纪要生成
- 💾 本地存储录音和纪要

## 技术栈

- **前端**: Vue 3 + Vite + TypeScript + Vant 4
- **后端**: Node.js + Express + WebSocket
- **语音识别**: 讯飞实时语音转写大模型

## 本地开发

### 后端

```bash
cd backend
npm install
cp .env.example .env
# 编辑 .env 填入讯飞 API 凭据
npm run dev
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问 https://localhost:5173

## 部署

### 后端 (Railway)

1. 在 Railway 创建项目
2. 连接 GitHub 仓库
3. 设置环境变量（XFYUN_APP_ID, XFYUN_API_KEY, XFYUN_API_SECRET）
4. 设置 Root Directory: `backend`

### 前端 (Vercel)

1. 在 Vercel 导入项目
2. 设置 Root Directory: `frontend`
3. 设置环境变量 VITE_API_URL 为后端 URL

## 环境变量

### 后端
- `XFYUN_APP_ID` - 讯飞 App ID
- `XFYUN_API_KEY` - 讯飞 API Key
- `XFYUN_API_SECRET` - 讯飞 API Secret
- `PORT` - 服务端口（默认 3000）

### 前端
- `VITE_API_URL` - 后端 API 地址
