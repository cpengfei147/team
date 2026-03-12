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
import { getMeeting, getSegments, addSegment, deleteSegment, db, saveSummary } from '../utils/db'
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
    const apiBase = import.meta.env.VITE_API_URL || ''
    const response = await fetch(`${apiBase}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fullText })
    })

    const data = await response.json()

    // Save summary to DB
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
