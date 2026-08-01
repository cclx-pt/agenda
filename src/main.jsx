import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './hooks/useAuth'
import { I18nProvider } from './hooks/useI18n'
import App from './App.jsx'
import LogsPage from './components/LogsPage'
import ApprovalActionPage from './components/ApprovalActionPage'
import LoopPage from './components/LoopPage'
import InvitePage from './components/invite/InvitePage'
import InviteManage from './components/invite/InviteManage'
import InviteCheckin from './components/invite/InviteCheckin'
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

// Rotas simples sem react-router: /logs (estado), /acao (ação de aprovação)
// e /loop/<igreja> (carrossel público para TV).
const routePath = window.location.pathname.replace(/\/+$/, '')
const isLogsRoute = routePath === '/logs'
const isActionRoute = routePath === '/acao'
const isLoopRoute = routePath.startsWith('/loop/')
const loopChurch = isLoopRoute ? decodeURIComponent(routePath.slice('/loop/'.length)) : null
const isInviteRoute = routePath.startsWith('/invite/')
// /invite/<slug> (landing) ou /invite/<slug>/inscricao (página só de inscrição).
// ?preview=<id> → pré-visualização do organizador (funciona com rascunho/fechado).
let inviteSlug = null
let inviteView = 'landing'
let invitePreviewId = null
let inviteCheckinToken = null
if (isInviteRoute) {
  const parts = routePath.slice('/invite/'.length).split('/')
  inviteSlug = decodeURIComponent(parts[0])
  if (parts[1] === 'inscricao') inviteView = 'rsvp'
  else if (parts[1] === 'gerir') inviteView = 'manage'
  else if (parts[1] === 'checkin') inviteView = 'checkin'
  invitePreviewId = new URLSearchParams(window.location.search).get('preview') || null
  inviteCheckinToken = new URLSearchParams(window.location.search).get('k') || null
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {isActionRoute ? (
        <ApprovalActionPage />
      ) : isLoopRoute ? (
        <I18nProvider>
          <LoopPage church={loopChurch} />
        </I18nProvider>
      ) : isInviteRoute ? (
        <I18nProvider>
          {inviteView === 'manage' ? (
            <InviteManage slug={inviteSlug} />
          ) : inviteView === 'checkin' ? (
            <InviteCheckin slug={inviteSlug} token={inviteCheckinToken} />
          ) : (
            <InvitePage slug={inviteSlug} view={inviteView} previewId={invitePreviewId} />
          )}
        </I18nProvider>
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
