import { createApp } from 'vue'
import { createPinia } from 'pinia'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import App from '../App.vue'
import '../styles/application.css'

dayjs.locale('fr')

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
