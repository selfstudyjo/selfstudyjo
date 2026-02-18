import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

// Register service worker immediately (works on localhost and HTTPS)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('Service Worker registered with scope:', reg.scope);
    }).catch(err => {
        console.warn('Service Worker registration failed:', err);
    });
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
