import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
// @ts-ignore: no declaration file for './router'
import router from './router'
import { useColorMode } from './composables/useColorMode'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// Initialize color mode
const { colorMode } = useColorMode()
console.log('Initial color mode:', colorMode.value)

app.mount('#app')

