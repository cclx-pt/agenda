import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './hooks/useAuth'
import { I18nProvider } from './hooks/useI18n'
import App from './App.jsx'
import LogsPage from './components/LogsPage'
import ApprovalActionPage from './components/ApprovalActionPage'
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

// Rotas simples sem react-router: /logs (estado) e /acao (ação de aprovação).
const routePath = window.location.pathname.replace(/\/+$/, '')
const isLogsRoute = routePath === '/logs'
const isActionRoute = routePath === '/acao'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {isActionRoute ? (
        <ApprovalActionPage />
      ) : isLogsRoute ? (
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
