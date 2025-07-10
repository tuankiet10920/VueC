import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import EchoInstance from './plugins/echo' // Import Echo instance của bạn

// Nhập Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css'
// Nhập Bootstrap JavaScript (bundle bao gồm Popper)
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

const app = createApp(App)

// Gắn Echo instance vào globalProperties để dễ dàng truy cập trong các component
app.config.globalProperties.$echo = EchoInstance

app.use(createPinia())
app.use(router)

app.mount('#app')
