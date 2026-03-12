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
