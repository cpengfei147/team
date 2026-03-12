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
