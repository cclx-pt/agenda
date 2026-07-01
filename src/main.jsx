import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './hooks/useAuth'
import { I18nProvider } from './hooks/useI18n'
import App from './App.jsx'
import LogsPage from './components/LogsPage'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min before refetch
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
      refetchOnWindowFocus: false,
    },
  },
})

// Rota simples sem react-router: /logs mostra a página de estado/registos.
const isLogsRoute = window.location.pathname.replace(/\/+$/, '') === '/logs'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {isLogsRoute ? (
        <LogsPage />
      ) : (
        <I18nProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </I18nProvider>
      )}
    </QueryClientProvider>
  </React.StrictMode>,
)
