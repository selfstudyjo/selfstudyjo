import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('SW registered');
            const token = import.meta.env.VITE_AUTH_TOKEN;
            if (token && token !== 'Token Not Found!' && token !== 'your-actual-auth-token-here') {
                navigator.serviceWorker.ready.then(registration => {
                    registration.active?.postMessage({
                        type: 'SET_AUTH_TOKEN',
                        token: token
                    });
                });
            }
        }).catch(err => console.warn('SW registration failed:', err));
    });

    // If a new service worker takes over, reload to ensure all fetches go through it
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
}

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.mount('#app')
