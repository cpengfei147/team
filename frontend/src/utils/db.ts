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
