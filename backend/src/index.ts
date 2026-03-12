import express from 'express'
import cors from 'cors'
import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import dotenv from 'dotenv'
import { XfyunASR } from './xfyun'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws/transcribe' })

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Check if Xfyun API is configured
const hasXfyunConfig = process.env.XFYUN_APP_ID && process.env.XFYUN_API_KEY && process.env.XFYUN_API_SECRET

console.log('Xfyun API configured:', hasXfyunConfig ? 'Yes' : 'No (using mock)')

// WebSocket connection handler
wss.on('connection', async (clientWs: WebSocket) => {
  console.log('Client connected')

  let xfyun: XfyunASR | null = null
  let savedText = ''   // Completed sentences
  let lastText = ''    // Current sentence text

  if (hasXfyunConfig) {
    // Use real Xfyun API
    xfyun = new XfyunASR({
      appId: process.env.XFYUN_APP_ID!,
      apiKey: process.env.XFYUN_API_KEY!,
      apiSecret: process.env.XFYUN_API_SECRET!,
      wssUrl: process.env.XFYUN_WSS_URL
    })

    xfyun.onResult = (text, isFinal, segId) => {
      console.log('Segment', segId, ':', text, 'isFinal:', isFinal)

      // Check if this is a continuation (text starts with beginning of lastText)
      const checkLen = Math.min(5, lastText.length)
      const isContinuation = lastText.length > 0 && text.startsWith(lastText.slice(0, checkLen))

      if (isContinuation) {
        // Same sentence, just update
        lastText = text
      } else if (lastText.length > 0 && text.length > 0) {
        // New sentence - check for overlap at boundary
        let overlap = 0
        // Check if newText starts with the ending of lastText
        for (let i = 1; i <= Math.min(lastText.length, text.length, 15); i++) {
          if (lastText.endsWith(text.slice(0, i))) {
            overlap = i
          }
        }

        console.log('New sentence, overlap:', overlap, 'chars')

        // Save previous sentence
        savedText = savedText + lastText
        // Remove overlap from new text
        lastText = overlap > 0 ? text.slice(overlap) : text
      } else {
        lastText = text
      }

      const fullTranscript = savedText + lastText
      console.log('Full transcript:', fullTranscript)

      clientWs.send(JSON.stringify({
        type: 'transcript',
        text: fullTranscript,
        isFinal
      }))
    }

    xfyun.onError = (error) => {
      console.error('Xfyun error:', error.message)
      clientWs.send(JSON.stringify({
        type: 'error',
        message: error.message
      }))
    }

    try {
      await xfyun.connect()
    } catch (error) {
      console.error('Failed to connect to Xfyun:', error)
      xfyun = null
    }
  }

  // Mock mode fallback
  const mockPhrases = ['今天我们讨论', '项目进度，', '前端已完成，', '后端就绪。']
  let mockIndex = 0
  let mockText = ''

  clientWs.on('message', (data: Buffer) => {
    if (xfyun) {
      // Forward audio to Xfyun
      xfyun.sendAudio(data)
    } else {
      // Mock mode
      if (mockIndex < mockPhrases.length) {
        mockText += mockPhrases[mockIndex]
        mockIndex++
      }
      clientWs.send(JSON.stringify({
        type: 'transcript',
        text: mockText,
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
