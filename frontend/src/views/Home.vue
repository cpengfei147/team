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
