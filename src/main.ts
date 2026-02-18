import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

// Register service worker immediately
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('Service Worker registered');
        // If page isn't controlled, reload to activate
        if (!navigator.serviceWorker.controller) {
            window.location.reload();
        }
    }).catch(err => console.warn('SW registration failed:', err));
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
