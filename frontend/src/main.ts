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
