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
