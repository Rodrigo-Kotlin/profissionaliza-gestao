import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { AppProviders } from '@/app/providers'
import { router } from '@/routes/router'
import '@/index.css'

registerSW({ immediate: true })
createRoot(document.getElementById('root')!).render(<StrictMode><AppProviders><RouterProvider router={router} /></AppProviders></StrictMode>)
