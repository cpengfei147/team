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
