import WebSocket from 'ws'
import crypto from 'crypto'

// Python-compatible URL encoding (matches urllib.parse.quote with safe='')
// RFC 3986 unreserved characters: A-Z a-z 0-9 - _ . ~
function pythonQuote(str: string): string {
  return str.split('').map(char => {
    if (/[A-Za-z0-9\-_.~]/.test(char)) {
      return char
    }
    return '%' + char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')
  }).join('')
}

interface XfyunConfig {
  appId: string
  apiKey: string      // accessKeyId
  apiSecret: string   // accessKeySecret
  wssUrl?: string
}

export class XfyunASR {
  private config: XfyunConfig
  private ws: WebSocket | null = null
  private sessionId: string

  onResult: ((text: string, isFinal: boolean, segId: number) => void) | null = null
  onError: ((error: Error) => void) | null = null

  constructor(config: XfyunConfig) {
    this.config = config
    this.sessionId = this.generateUUID()
  }

  private generateUUID(): string {
    // Generate 32-character hex string without dashes (matching official Python demo)
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  private getAuthUrl(): string {
    let baseUrl = this.config.wssUrl || 'wss://office-api-ast-dx.iflyaisol.com'
    // Remove trailing slash if present
    baseUrl = baseUrl.replace(/\/$/, '')
    const path = '/ast/communicate/v1'

    // Generate Beijing time timestamp in format: 2025-09-04T15:38:07+0800
    // Must use actual Beijing time (UTC+8), not server local time
    const now = new Date()
    const beijingTime = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60 * 1000)
    const year = beijingTime.getFullYear()
    const month = String(beijingTime.getMonth() + 1).padStart(2, '0')
    const day = String(beijingTime.getDate()).padStart(2, '0')
    const hours = String(beijingTime.getHours()).padStart(2, '0')
    const minutes = String(beijingTime.getMinutes()).padStart(2, '0')
    const seconds = String(beijingTime.getSeconds()).padStart(2, '0')
    const utc = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+0800`

    console.log('UTC timestamp:', utc)
    console.log('UUID:', this.sessionId)

    // Build params object (per official docs)
    const params: Record<string, string> = {
      appId: this.config.appId,
      accessKeyId: this.config.apiKey,
      utc: utc,
      uuid: this.sessionId,
      audio_encode: 'pcm_s16le',
      lang: 'autodialect',
      samplerate: '16000'
    }

    // Sort params and build string for signature (WITH URL encoding per docs)
    // Use Python-compatible encoding to match official demo exactly
    const sortedKeys = Object.keys(params).sort()
    const paramString = sortedKeys.map(k => `${pythonQuote(k)}=${pythonQuote(params[k])}`).join('&')

    // Generate signature using HmacSHA1
    const signature = crypto
      .createHmac('sha1', this.config.apiSecret)
      .update(paramString)
      .digest('base64')

    console.log('Signature base string:', paramString)
    console.log('Signature:', signature)

    // Build final URL (params already encoded in paramString)
    const finalUrl = `${baseUrl}${path}?${paramString}&signature=${pythonQuote(signature)}`
    console.log('Full WebSocket URL:', finalUrl)
    return finalUrl
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.getAuthUrl()
      console.log('Connecting to Xfyun...')

      this.ws = new WebSocket(url)

      this.ws.on('open', () => {
        console.log('Xfyun WebSocket connected')
        resolve()
      })

      this.ws.on('message', (data) => {
        try {
          const result = JSON.parse(data.toString())
          console.log('Xfyun response:', JSON.stringify(result).substring(0, 200))

          if (result.code && result.code !== '0' && result.code !== 0) {
            console.error('Xfyun error:', result)
            if (this.onError) {
              this.onError(new Error(result.message || `Error code: ${result.code}`))
            }
            return
          }

          // Handle different message types (msg_type field)
          if (result.msg_type === 'action' && result.data?.action === 'started') {
            console.log('Xfyun session started')
          } else if (result.msg_type === 'result') {
            // Extract text from result
            if (result.data) {
              let text = ''
              const segId = result.data.seg_id ?? 0

              // Parse the cn.st.rt[0].ws[].cw[0].w structure (only take first rt and first cw)
              if (result.data.cn && result.data.cn.st) {
                const st = result.data.cn.st
                if (st.rt && Array.isArray(st.rt) && st.rt[0]) {
                  const firstRt = st.rt[0]  // Only take first recognition result
                  if (firstRt.ws && Array.isArray(firstRt.ws)) {
                    text = firstRt.ws.map((w: any) =>
                      w.cw && w.cw[0] ? w.cw[0].w : ''  // Only take first candidate
                    ).join('')
                  }
                }
              }

              const isFinal = result.data.ls === true

              console.log('Segment', segId, ':', text, 'isFinal:', isFinal)

              if (this.onResult) {
                // Pass segId to allow proper segment tracking
                this.onResult(text, isFinal, segId)
              }
            }
          } else if (result.msg_type === 'error') {
            if (this.onError) {
              this.onError(new Error(result.data?.message || 'Unknown error'))
            }
          }
        } catch (e) {
          console.error('Parse error:', e)
        }
      })

      this.ws.on('error', (error) => {
        console.error('Xfyun WebSocket error:', error)
        if (this.onError) this.onError(error)
        reject(error)
      })

      this.ws.on('close', (code, reason) => {
        console.log('Xfyun WebSocket closed:', code, reason.toString())
        this.ws = null
      })
    })
  }

  sendAudio(audioData: Buffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send raw PCM audio data directly
      this.ws.send(audioData)
    }
  }

  close(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send end marker
      const endMsg = JSON.stringify({
        end: true,
        sessionId: this.sessionId
      })
      this.ws.send(endMsg)

      // Close after a short delay
      setTimeout(() => {
        if (this.ws) {
          this.ws.close()
          this.ws = null
        }
      }, 500)
    }
  }
}
