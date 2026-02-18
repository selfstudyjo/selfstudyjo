import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

// Register service worker as early as possible (only in development)
if ('serviceWorker' in navigator && import.meta.env.DEV) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('Service Worker registered for media fallback');
    }).catch(err => {
        console.warn('Service Worker registration failed:', err);
    });
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
