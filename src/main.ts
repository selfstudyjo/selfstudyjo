import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

// Register service worker for media fallback (only in development)
if ('serviceWorker' in navigator && import.meta.env.DEV) {
    // Use a promise to ensure registration completes
    (async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            console.log('Service Worker registered with scope:', registration.scope);

            // Wait for the service worker to become active
            if (registration.active) {
                console.log('Service Worker already active');
            } else if (registration.installing) {
                console.log('Service Worker installing...');
            } else if (registration.waiting) {
                console.log('Service Worker waiting, skipWaiting should activate');
            }

            // If the page is not yet controlled, reload once to ensure the service worker takes over
            if (!navigator.serviceWorker.controller) {
                console.log('No controller, reloading...');
                window.location.reload();
            }
        } catch (err) {
            console.warn('Service Worker registration failed:', err);
        }
    })();
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
