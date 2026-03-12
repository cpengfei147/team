# 会议助手 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个手机网页版会议录音转写和纪要生成工具

**Architecture:** 前后端分离架构。前端 Vue 3 + Vant 4 负责录音采集和 UI 展示，通过 WebSocket 与后端通信。后端 Node.js + Express 负责转发音频到讯飞 API 进行实时转写，以及调用 DeepSeek 生成会议纪要。本地存储使用 IndexedDB。

**Tech Stack:** Vue 3, Vite, Vant 4, Dexie.js, Node.js, Express, WebSocket, 讯飞实时语音转写 API, DeepSeek API

---

## Phase 1: 项目初始化

### Task 1: 初始化前端项目

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`

**Step 1: 创建前端项目**

```bash
cd /Users/zhouxiaomei/zhou/CQLens/team
npm create vite@latest frontend -- --template vue-ts
```

**Step 2: 安装依赖**

```bash
cd frontend && npm install
npm install vant @vant/use dexie vue-router
```

**Step 3: 配置 Vant 和移动端适配**

修改 `frontend/src/main.ts`:

```typescript
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import 'vant/lib/index.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('./views/Home.vue') },
    { path: '/meeting/:id', component: () => import('./views/Meeting.vue') },
    { path: '/summary/:id', component: () => import('./views/Summary.vue') },
  ]
})

const app = createApp(App)
app.use(router)
app.mount('#app')
```

**Step 4: 配置移动端 viewport**

修改 `frontend/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>会议助手</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**Step 5: 验证前端启动**

```bash
npm run dev
```

Expected: 浏览器打开 http://localhost:5173 显示 Vue 默认页面

**Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: initialize frontend with Vue 3 + Vant 4"
```

---

### Task 2: 初始化后端项目

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/index.ts`

**Step 1: 创建后端目录和 package.json**

```bash
mkdir -p backend/src
cd backend
npm init -y
npm install express cors ws dotenv
npm install -D typescript @types/node @types/express @types/ws ts-node nodemon
```

**Step 2: 创建 tsconfig.json**

创建 `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 3: 创建入口文件**

创建 `backend/src/index.ts`:

```typescript
import express from 'express'
import cors from 'cors'
import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws/transcribe' })

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// WebSocket connection handler
wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected')

  ws.on('message', (data: Buffer) => {
    // TODO: Forward to Xunfei API
    // For now, send mock response
    ws.send(JSON.stringify({
      type: 'transcript',
      text: '[Mock] 收到音频数据...',
      isFinal: false
    }))
  })

  ws.on('close', () => {
    console.log('Client disconnected')
  })
})

// Summarize endpoint
app.post('/api/summarize', async (req, res) => {
  const { text } = req.body

  // TODO: Call DeepSeek API
  // For now, return mock response
  res.json({
    structured: {
      topics: ['议题1: 项目进度讨论', '议题2: 下周计划'],
      keyPoints: ['本周完成了核心功能开发', '测试覆盖率达到80%'],
      decisions: ['下周一发布第一版'],
      actionItems: [
        { person: '张三', task: '完成文档编写' },
        { person: '李四', task: '准备演示环境' }
      ]
    }
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
```

**Step 4: 添加开发脚本**

修改 `backend/package.json` 的 scripts:

```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Step 5: 验证后端启动**

```bash
npm run dev
```

Expected: 控制台显示 "Server running on http://localhost:3000"

**Step 6: 测试 health 接口**

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok"}`

**Step 7: Commit**

```bash
git add backend/
git commit -m "feat: initialize backend with Express + WebSocket"
```

---

## Phase 2: 本地存储层

### Task 3: 实现 IndexedDB 数据库

**Files:**
- Create: `frontend/src/utils/db.ts`
- Create: `frontend/src/types/index.ts`

**Step 1: 定义数据类型**

创建 `frontend/src/types/index.ts`:

```typescript
export interface Meeting {
  id?: number
  title: string
  createdAt: Date
  updatedAt: Date
}

export interface Segment {
  id?: number
  meetingId: number
  startTime: Date
  duration: number
  transcript: string
}

export interface Summary {
  id?: number
  meetingId: number
  createdAt: Date
  fullText: string
  structured: {
    topics: string[]
    keyPoints: string[]
    decisions: string[]
    actionItems: { person: string; task: string }[]
  }
}
```

**Step 2: 创建数据库配置**

创建 `frontend/src/utils/db.ts`:

```typescript
import Dexie, { type Table } from 'dexie'
import type { Meeting, Segment, Summary } from '../types'

export class MeetingDatabase extends Dexie {
  meetings!: Table<Meeting>
  segments!: Table<Segment>
  summaries!: Table<Summary>

  constructor() {
    super('MeetingAssistant')
    this.version(1).stores({
      meetings: '++id, title, createdAt',
      segments: '++id, meetingId, startTime',
      summaries: '++id, meetingId'
    })
  }
}

export const db = new MeetingDatabase()

// Meeting CRUD
export async function createMeeting(title: string): Promise<number> {
  const now = new Date()
  return await db.meetings.add({
    title,
    createdAt: now,
    updatedAt: now
  })
}

export async function getMeetings(): Promise<Meeting[]> {
  return await db.meetings.orderBy('createdAt').reverse().toArray()
}

export async function getMeeting(id: number): Promise<Meeting | undefined> {
  return await db.meetings.get(id)
}

export async function deleteMeeting(id: number): Promise<void> {
  await db.segments.where('meetingId').equals(id).delete()
  await db.summaries.where('meetingId').equals(id).delete()
  await db.meetings.delete(id)
}

// Segment CRUD
export async function addSegment(
  meetingId: number,
  transcript: string,
  duration: number
): Promise<number> {
  return await db.segments.add({
    meetingId,
    startTime: new Date(),
    duration,
    transcript
  })
}

export async function getSegments(meetingId: number): Promise<Segment[]> {
  return await db.segments.where('meetingId').equals(meetingId).toArray()
}

export async function deleteSegment(id: number): Promise<void> {
  await db.segments.delete(id)
}

// Summary CRUD
export async function saveSummary(
  meetingId: number,
  fullText: string,
  structured: Summary['structured']
): Promise<number> {
  // Delete existing summary for this meeting
  await db.summaries.where('meetingId').equals(meetingId).delete()

  return await db.summaries.add({
    meetingId,
    createdAt: new Date(),
    fullText,
    structured
  })
}

export async function getSummary(meetingId: number): Promise<Summary | undefined> {
  return await db.summaries.where('meetingId').equals(meetingId).first()
}
```

**Step 3: Commit**

```bash
git add frontend/src/types/ frontend/src/utils/
git commit -m "feat: add IndexedDB storage layer with Dexie"
```

---

## Phase 3: 前端页面实现

### Task 4: 实现首页 - 会议列表

**Files:**
- Create: `frontend/src/views/Home.vue`
- Modify: `frontend/src/App.vue`

**Step 1: 创建 views 目录**

```bash
mkdir -p frontend/src/views
```

**Step 2: 实现首页**

创建 `frontend/src/views/Home.vue`:

```vue
<template>
  <div class="home">
    <van-nav-bar title="我的会议" />

    <van-empty v-if="meetings.length === 0" description="暂无会议记录" />

    <van-cell-group v-else inset>
      <van-swipe-cell v-for="meeting in meetings" :key="meeting.id">
        <van-cell
          :title="meeting.title"
          :label="formatDate(meeting.createdAt)"
          is-link
          @click="goToMeeting(meeting.id!)"
        />
        <template #right>
          <van-button
            square
            type="danger"
            text="删除"
            @click="handleDelete(meeting.id!)"
          />
        </template>
      </van-swipe-cell>
    </van-cell-group>

    <div class="fab-container">
      <van-button
        round
        type="primary"
        icon="plus"
        @click="showDialog = true"
      >
        新建会议
      </van-button>
    </div>

    <van-dialog
      v-model:show="showDialog"
      title="新建会议"
      show-cancel-button
      @confirm="handleCreate"
    >
      <van-field
        v-model="newTitle"
        placeholder="请输入会议名称"
        :rules="[{ required: true, message: '请输入会议名称' }]"
      />
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NavBar as VanNavBar,
  Cell as VanCell,
  CellGroup as VanCellGroup,
  SwipeCell as VanSwipeCell,
  Button as VanButton,
  Empty as VanEmpty,
  Dialog as VanDialog,
  Field as VanField,
  showConfirmDialog,
  showToast
} from 'vant'
import { getMeetings, createMeeting, deleteMeeting } from '../utils/db'
import type { Meeting } from '../types'

const router = useRouter()
const meetings = ref<Meeting[]>([])
const showDialog = ref(false)
const newTitle = ref('')

onMounted(async () => {
  await loadMeetings()
})

async function loadMeetings() {
  meetings.value = await getMeetings()
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function goToMeeting(id: number) {
  router.push(`/meeting/${id}`)
}

async function handleCreate() {
  if (!newTitle.value.trim()) {
    showToast('请输入会议名称')
    return
  }
  const id = await createMeeting(newTitle.value.trim())
  newTitle.value = ''
  showToast('创建成功')
  router.push(`/meeting/${id}`)
}

async function handleDelete(id: number) {
  try {
    await showConfirmDialog({
      title: '确认删除',
      message: '删除后无法恢复，确定要删除吗？'
    })
    await deleteMeeting(id)
    showToast('已删除')
    await loadMeetings()
  } catch {
    // User cancelled
  }
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: #f7f8fa;
}

.fab-container {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
}
</style>
```

**Step 3: 更新 App.vue**

修改 `frontend/src/App.vue`:

```vue
<template>
  <router-view />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
```

**Step 4: 验证页面显示**

```bash
cd frontend && npm run dev
```

Expected: 打开 http://localhost:5173 显示"我的会议"页面，点击"新建会议"可以创建

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: implement home page with meeting list"
```

---

### Task 5: 实现会议详情页 - 录音功能

**Files:**
- Create: `frontend/src/views/Meeting.vue`
- Create: `frontend/src/utils/recorder.ts`
- Create: `frontend/src/utils/websocket.ts`

**Step 1: 实现录音工具**

创建 `frontend/src/utils/recorder.ts`:

```typescript
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null

  onAudioData: ((data: ArrayBuffer) => void) | null = null

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    })

    this.audioContext = new AudioContext({ sampleRate: 16000 })
    this.source = this.audioContext.createMediaStreamSource(this.stream)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0)
      const pcmData = this.floatTo16BitPCM(inputData)
      if (this.onAudioData) {
        this.onAudioData(pcmData.buffer)
      }
    }

    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }

  stop(): void {
    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
  }

  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16Array
  }
}
```

**Step 2: 实现 WebSocket 工具**

创建 `frontend/src/utils/websocket.ts`:

```typescript
export class TranscribeSocket {
  private ws: WebSocket | null = null
  private url: string

  onTranscript: ((text: string, isFinal: boolean) => void) | null = null
  onError: ((error: Event) => void) | null = null
  onClose: (() => void) | null = null

  constructor(url: string = 'ws://localhost:3000/ws/transcribe') {
    this.url = url
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        resolve()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        if (this.onError) this.onError(error)
        reject(error)
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'transcript' && this.onTranscript) {
            this.onTranscript(data.text, data.isFinal)
          }
        } catch (e) {
          console.error('Failed to parse message:', e)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket closed')
        if (this.onClose) this.onClose()
      }
    })
  }

  send(audioData: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioData)
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
```

**Step 3: 实现会议详情页**

创建 `frontend/src/views/Meeting.vue`:

```vue
<template>
  <div class="meeting">
    <van-nav-bar
      :title="meeting?.title || '会议详情'"
      left-arrow
      @click-left="router.back()"
    >
      <template #right>
        <van-icon name="edit" @click="showEditDialog = true" />
      </template>
    </van-nav-bar>

    <!-- Segments List -->
    <div class="segments-container">
      <van-empty v-if="segments.length === 0" description="暂无录音片段" />

      <div v-for="(segment, index) in segments" :key="segment.id" class="segment-card">
        <van-checkbox v-model="selectedIds[segment.id!]" shape="square">
          <div class="segment-header">
            <span class="segment-title">片段 {{ index + 1 }}</span>
            <span class="segment-meta">
              {{ formatTime(segment.startTime) }} · {{ formatDuration(segment.duration) }}
            </span>
          </div>
        </van-checkbox>
        <div class="segment-content">{{ segment.transcript || '(空)' }}</div>
        <van-button
          size="small"
          type="danger"
          plain
          @click="handleDeleteSegment(segment.id!)"
        >
          删除
        </van-button>
      </div>
    </div>

    <!-- Real-time Transcript Display -->
    <div v-if="isRecording" class="transcript-live">
      <div class="transcript-header">
        <span class="recording-dot"></span>
        <span>正在录音...</span>
      </div>
      <div class="transcript-text">{{ currentTranscript || '等待语音输入...' }}</div>
    </div>

    <!-- Bottom Actions -->
    <div class="bottom-actions">
      <van-button
        v-if="!isRecording"
        type="primary"
        round
        icon="audio"
        @click="startRecording"
      >
        开始录音
      </van-button>
      <van-button
        v-else
        type="danger"
        round
        icon="stop-circle-o"
        @click="stopRecording"
      >
        停止录音
      </van-button>

      <van-button
        type="success"
        round
        :disabled="selectedCount === 0"
        @click="generateSummary"
      >
        生成纪要 ({{ selectedCount }})
      </van-button>
    </div>

    <!-- Edit Dialog -->
    <van-dialog
      v-model:show="showEditDialog"
      title="编辑会议名称"
      show-cancel-button
      @confirm="handleUpdateTitle"
    >
      <van-field v-model="editTitle" placeholder="会议名称" />
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NavBar as VanNavBar,
  Icon as VanIcon,
  Empty as VanEmpty,
  Button as VanButton,
  Checkbox as VanCheckbox,
  Dialog as VanDialog,
  Field as VanField,
  showToast,
  showLoadingToast,
  closeToast
} from 'vant'
import { getMeeting, getSegments, addSegment, deleteSegment, db } from '../utils/db'
import { AudioRecorder } from '../utils/recorder'
import { TranscribeSocket } from '../utils/websocket'
import type { Meeting, Segment } from '../types'

const router = useRouter()
const route = useRoute()
const meetingId = Number(route.params.id)

const meeting = ref<Meeting>()
const segments = ref<Segment[]>([])
const selectedIds = ref<Record<number, boolean>>({})
const isRecording = ref(false)
const currentTranscript = ref('')
const showEditDialog = ref(false)
const editTitle = ref('')

let recorder: AudioRecorder | null = null
let socket: TranscribeSocket | null = null
let recordingStartTime: number = 0

const selectedCount = computed(() => {
  return Object.values(selectedIds.value).filter(Boolean).length
})

onMounted(async () => {
  await loadData()
})

onUnmounted(() => {
  if (isRecording.value) {
    stopRecording()
  }
})

async function loadData() {
  meeting.value = await getMeeting(meetingId)
  segments.value = await getSegments(meetingId)
  if (meeting.value) {
    editTitle.value = meeting.value.title
  }
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}分${secs}秒`
}

async function startRecording() {
  try {
    // Connect WebSocket first
    socket = new TranscribeSocket()
    socket.onTranscript = (text, isFinal) => {
      currentTranscript.value = text
    }
    await socket.connect()

    // Start recorder
    recorder = new AudioRecorder()
    recorder.onAudioData = (data) => {
      socket?.send(data)
    }
    await recorder.start()

    isRecording.value = true
    currentTranscript.value = ''
    recordingStartTime = Date.now()

    showToast('开始录音')
  } catch (error) {
    console.error('Failed to start recording:', error)
    showToast('无法启动录音，请检查麦克风权限')
  }
}

async function stopRecording() {
  if (recorder) {
    recorder.stop()
    recorder = null
  }

  if (socket) {
    socket.close()
    socket = null
  }

  const duration = Math.round((Date.now() - recordingStartTime) / 1000)

  if (currentTranscript.value.trim()) {
    await addSegment(meetingId, currentTranscript.value, duration)
    await loadData()
    showToast('录音已保存')
  }

  isRecording.value = false
  currentTranscript.value = ''
}

async function handleDeleteSegment(id: number) {
  await deleteSegment(id)
  delete selectedIds.value[id]
  await loadData()
  showToast('已删除')
}

async function handleUpdateTitle() {
  if (meeting.value && editTitle.value.trim()) {
    await db.meetings.update(meeting.value.id!, {
      title: editTitle.value.trim(),
      updatedAt: new Date()
    })
    await loadData()
    showToast('已更新')
  }
}

async function generateSummary() {
  const selected = segments.value.filter(s => selectedIds.value[s.id!])
  if (selected.length === 0) {
    showToast('请选择要总结的片段')
    return
  }

  const fullText = selected.map(s => s.transcript).join('\n\n')

  showLoadingToast({ message: '生成中...', duration: 0 })

  try {
    const response = await fetch('http://localhost:3000/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fullText })
    })

    const data = await response.json()

    // Save summary to DB
    const { saveSummary } = await import('../utils/db')
    await saveSummary(meetingId, fullText, data.structured)

    closeToast()
    router.push(`/summary/${meetingId}`)
  } catch (error) {
    closeToast()
    showToast('生成失败，请重试')
    console.error(error)
  }
}
</script>

<style scoped>
.meeting {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: 100px;
}

.segments-container {
  padding: 12px;
}

.segment-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.segment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-left: 8px;
}

.segment-title {
  font-weight: 500;
}

.segment-meta {
  font-size: 12px;
  color: #999;
}

.segment-content {
  margin: 8px 0 8px 28px;
  font-size: 14px;
  color: #666;
  line-height: 1.5;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.transcript-live {
  margin: 12px;
  padding: 16px;
  background: #fff3e0;
  border-radius: 8px;
}

.transcript-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 500;
}

.recording-dot {
  width: 8px;
  height: 8px;
  background: #f44336;
  border-radius: 50%;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.transcript-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  min-height: 40px;
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: white;
  display: flex;
  gap: 12px;
  justify-content: center;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}
</style>
```

**Step 4: 验证录音功能**

1. 启动后端: `cd backend && npm run dev`
2. 启动前端: `cd frontend && npm run dev`
3. 打开浏览器，新建会议，点击"开始录音"

Expected: 录音按钮变为"停止录音"，显示"正在录音..."

**Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: implement meeting page with recording"
```

---

### Task 6: 实现纪要查看页

**Files:**
- Create: `frontend/src/views/Summary.vue`

**Step 1: 实现纪要页面**

创建 `frontend/src/views/Summary.vue`:

```vue
<template>
  <div class="summary">
    <van-nav-bar
      title="会议纪要"
      left-arrow
      @click-left="router.back()"
    />

    <van-tabs v-model:active="activeTab" sticky>
      <van-tab title="结构化纪要">
        <div class="summary-content" v-if="summary">
          <section class="summary-section">
            <h3>📌 议题</h3>
            <ul>
              <li v-for="topic in summary.structured.topics" :key="topic">
                {{ topic }}
              </li>
            </ul>
          </section>

          <section class="summary-section">
            <h3>💬 讨论要点</h3>
            <ul>
              <li v-for="point in summary.structured.keyPoints" :key="point">
                {{ point }}
              </li>
            </ul>
          </section>

          <section class="summary-section">
            <h3>✅ 决议</h3>
            <ul>
              <li v-for="decision in summary.structured.decisions" :key="decision">
                {{ decision }}
              </li>
            </ul>
          </section>

          <section class="summary-section">
            <h3>📋 待办事项</h3>
            <ul>
              <li v-for="item in summary.structured.actionItems" :key="item.task">
                <strong>{{ item.person }}：</strong>{{ item.task }}
              </li>
            </ul>
          </section>
        </div>
      </van-tab>

      <van-tab title="完整转写">
        <div class="full-text" v-if="summary">
          {{ summary.fullText }}
        </div>
      </van-tab>
    </van-tabs>

    <div class="bottom-actions">
      <van-button type="primary" round icon="description" @click="copyToClipboard">
        复制纪要
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  NavBar as VanNavBar,
  Tabs as VanTabs,
  Tab as VanTab,
  Button as VanButton,
  showToast
} from 'vant'
import { getSummary } from '../utils/db'
import type { Summary } from '../types'

const router = useRouter()
const route = useRoute()
const meetingId = Number(route.params.id)

const summary = ref<Summary>()
const activeTab = ref(0)

onMounted(async () => {
  summary.value = await getSummary(meetingId)
  if (!summary.value) {
    showToast('未找到纪要')
    router.back()
  }
})

function formatSummaryText(): string {
  if (!summary.value) return ''

  const s = summary.value.structured
  let text = '📌 议题\n'
  text += s.topics.map(t => `• ${t}`).join('\n')
  text += '\n\n💬 讨论要点\n'
  text += s.keyPoints.map(p => `• ${p}`).join('\n')
  text += '\n\n✅ 决议\n'
  text += s.decisions.map(d => `• ${d}`).join('\n')
  text += '\n\n📋 待办事项\n'
  text += s.actionItems.map(i => `• ${i.person}：${i.task}`).join('\n')

  return text
}

async function copyToClipboard() {
  const text = activeTab.value === 0 ? formatSummaryText() : summary.value?.fullText
  if (text) {
    try {
      await navigator.clipboard.writeText(text)
      showToast('已复制到剪贴板')
    } catch {
      showToast('复制失败')
    }
  }
}
</script>

<style scoped>
.summary {
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: 80px;
}

.summary-content {
  padding: 16px;
}

.summary-section {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.summary-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
}

.summary-section ul {
  margin: 0;
  padding-left: 20px;
}

.summary-section li {
  margin-bottom: 8px;
  line-height: 1.5;
}

.full-text {
  padding: 16px;
  background: white;
  margin: 12px;
  border-radius: 8px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.bottom-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: white;
  display: flex;
  justify-content: center;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}
</style>
```

**Step 2: 验证纪要页面**

1. 新建会议 → 录音 → 停止 → 选中片段 → 生成纪要
2. 应跳转到纪要页面显示 mock 数据

Expected: 显示结构化纪要内容，可切换到完整转写，可复制

**Step 3: Commit**

```bash
git add frontend/src/views/Summary.vue
git commit -m "feat: implement summary view page"
```

---

## Phase 4: API 集成（待 API 密钥就绪后）

### Task 7: 集成讯飞实时语音转写

**Files:**
- Create: `backend/.env`
- Create: `backend/src/xfyun.ts`
- Modify: `backend/src/index.ts`

**Step 1: 创建环境变量文件**

创建 `backend/.env`:

```
XFYUN_APP_ID=your_app_id
XFYUN_API_KEY=your_api_key
XFYUN_API_SECRET=your_api_secret
DEEPSEEK_API_KEY=your_deepseek_key
```

**Step 2: 实现讯飞 API 封装**

创建 `backend/src/xfyun.ts`:

```typescript
import WebSocket from 'ws'
import crypto from 'crypto'

interface XfyunConfig {
  appId: string
  apiKey: string
  apiSecret: string
}

export class XfyunASR {
  private config: XfyunConfig
  private ws: WebSocket | null = null

  onResult: ((text: string, isFinal: boolean) => void) | null = null
  onError: ((error: Error) => void) | null = null

  constructor(config: XfyunConfig) {
    this.config = config
  }

  private getAuthUrl(): string {
    const host = 'iat-api.xfyun.cn'
    const path = '/v2/iat'
    const date = new Date().toUTCString()

    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`
    const signature = crypto
      .createHmac('sha256', this.config.apiSecret)
      .update(signatureOrigin)
      .digest('base64')

    const authorizationOrigin = `api_key="${this.config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
    const authorization = Buffer.from(authorizationOrigin).toString('base64')

    return `wss://${host}${path}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=${host}`
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.getAuthUrl()
      this.ws = new WebSocket(url)

      this.ws.on('open', () => {
        // Send first frame with config
        const frame = {
          common: { app_id: this.config.appId },
          business: {
            language: 'zh_cn',
            domain: 'iat',
            accent: 'mandarin',
            vad_eos: 3000,
            dwa: 'wpgs'
          },
          data: {
            status: 0,
            format: 'audio/L16;rate=16000',
            encoding: 'raw'
          }
        }
        this.ws!.send(JSON.stringify(frame))
        resolve()
      })

      this.ws.on('message', (data) => {
        try {
          const result = JSON.parse(data.toString())
          if (result.code !== 0) {
            if (this.onError) {
              this.onError(new Error(result.message))
            }
            return
          }

          if (result.data?.result) {
            const ws = result.data.result.ws || []
            const text = ws.map((w: any) => w.cw?.map((c: any) => c.w).join('')).join('')
            const isFinal = result.data.status === 2

            if (this.onResult && text) {
              this.onResult(text, isFinal)
            }
          }
        } catch (e) {
          console.error('Parse error:', e)
        }
      })

      this.ws.on('error', (error) => {
        if (this.onError) this.onError(error)
        reject(error)
      })

      this.ws.on('close', () => {
        this.ws = null
      })
    })
  }

  sendAudio(audioData: Buffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const frame = {
        data: {
          status: 1,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: audioData.toString('base64')
        }
      }
      this.ws.send(JSON.stringify(frame))
    }
  }

  close(): void {
    if (this.ws) {
      // Send last frame
      const frame = {
        data: {
          status: 2,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: ''
        }
      }
      this.ws.send(JSON.stringify(frame))
      this.ws.close()
      this.ws = null
    }
  }
}
```

**Step 3: 更新后端入口集成讯飞**

修改 `backend/src/index.ts` 中的 WebSocket 处理：

```typescript
// Add at top
import { XfyunASR } from './xfyun'
import dotenv from 'dotenv'
dotenv.config()

// Replace WebSocket handler
wss.on('connection', async (clientWs: WebSocket) => {
  console.log('Client connected')

  let xfyun: XfyunASR | null = null
  let fullTranscript = ''

  // Check if we have API keys
  const hasApiKeys = process.env.XFYUN_APP_ID && process.env.XFYUN_API_KEY

  if (hasApiKeys) {
    xfyun = new XfyunASR({
      appId: process.env.XFYUN_APP_ID!,
      apiKey: process.env.XFYUN_API_KEY!,
      apiSecret: process.env.XFYUN_API_SECRET!
    })

    xfyun.onResult = (text, isFinal) => {
      fullTranscript += text
      clientWs.send(JSON.stringify({
        type: 'transcript',
        text: fullTranscript,
        isFinal
      }))
    }

    xfyun.onError = (error) => {
      console.error('Xfyun error:', error)
    }

    await xfyun.connect()
  }

  clientWs.on('message', (data: Buffer) => {
    if (xfyun) {
      xfyun.sendAudio(data)
    } else {
      // Mock mode
      clientWs.send(JSON.stringify({
        type: 'transcript',
        text: '[Mock] 收到音频数据...' + Date.now(),
        isFinal: false
      }))
    }
  })

  clientWs.on('close', () => {
    console.log('Client disconnected')
    if (xfyun) {
      xfyun.close()
    }
  })
})
```

**Step 4: Commit**

```bash
git add backend/
git commit -m "feat: integrate Xunfei real-time ASR API"
```

---

### Task 8: 集成 DeepSeek API

**Files:**
- Create: `backend/src/deepseek.ts`
- Modify: `backend/src/index.ts`

**Step 1: 实现 DeepSeek API 封装**

创建 `backend/src/deepseek.ts`:

```typescript
interface SummaryResult {
  topics: string[]
  keyPoints: string[]
  decisions: string[]
  actionItems: { person: string; task: string }[]
}

export async function summarizeMeeting(text: string): Promise<SummaryResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    // Return mock data if no API key
    return {
      topics: ['议题1: 示例议题'],
      keyPoints: ['这是示例讨论要点'],
      decisions: ['示例决议'],
      actionItems: [{ person: '待定', task: '示例任务' }]
    }
  }

  const prompt = `请分析以下会议记录，提取结构化信息。请以JSON格式返回，包含以下字段：
- topics: 会议议题列表
- keyPoints: 讨论要点列表
- decisions: 决议列表
- actionItems: 待办事项列表，每项包含 person（负责人）和 task（任务）

会议记录：
${text}

请直接返回JSON，不要有其他内容。`

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })
  })

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '{}'

  try {
    // Try to parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('Failed to parse DeepSeek response:', e)
  }

  return {
    topics: ['解析失败'],
    keyPoints: [],
    decisions: [],
    actionItems: []
  }
}
```

**Step 2: 更新后端 summarize 接口**

修改 `backend/src/index.ts` 中的 summarize 路由：

```typescript
import { summarizeMeeting } from './deepseek'

// Replace existing /api/summarize handler
app.post('/api/summarize', async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({ error: 'Text is required' })
    }

    const structured = await summarizeMeeting(text)
    res.json({ structured })
  } catch (error) {
    console.error('Summarize error:', error)
    res.status(500).json({ error: 'Failed to generate summary' })
  }
})
```

**Step 3: Commit**

```bash
git add backend/src/deepseek.ts backend/src/index.ts
git commit -m "feat: integrate DeepSeek API for meeting summary"
```

---

## Phase 5: 部署

### Task 9: 部署后端到 Railway

**Step 1: 准备部署配置**

创建 `backend/Procfile`:

```
web: npm start
```

**Step 2: 构建并部署**

```bash
cd backend
npm run build
# Follow Railway CLI or dashboard to deploy
```

### Task 10: 部署前端到 Vercel

**Step 1: 更新 API 地址配置**

创建 `frontend/.env.production`:

```
VITE_API_URL=https://your-railway-app.railway.app
```

**Step 2: 部署**

```bash
cd frontend
npm run build
# Deploy dist folder to Vercel
```

---

## 完成检查清单

- [ ] 前端可以新建/删除会议
- [ ] 录音功能正常工作
- [ ] 实时转写显示（Mock 或真实 API）
- [ ] 多段录音管理
- [ ] 生成会议纪要
- [ ] 纪要复制功能
- [ ] 数据本地持久化
- [ ] 移动端适配良好
