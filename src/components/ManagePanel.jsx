import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { useModalA11y } from '../hooks/useModalA11y'
import * as eventsService from '../services/eventsService'
import { useChurches, invalidateChurches } from '../hooks/useChurches'
import { useCategories, invalidateCategories } from '../hooks/useCategories'
import { usePrivacyTags, invalidatePrivacyTags } from '../hooks/usePrivacyTags'
import { CATEGORY_META, formatDateNumeric, formatDateNumericValue } from '../utils/calendarHelpers'
import { CHURCHES, CHURCH_NAMES, DEFAULT_CHURCH } from '../utils/churches'

// Mapa de estilos: utilitários Tailwind (tema neutro shadcn). Substitui o
// antigo CSS module, mantendo intactas as referências styles.* no JSX.
const styles = {
  overlay: 'fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-12 max-[560px]:p-0',
  panel: 'flex w-[720px] max-w-[96vw] flex-col rounded-xl border border-border bg-background shadow-lg max-h-[calc(100vh-96px)] max-[560px]:h-full max-[560px]:max-h-full max-[560px]:w-full max-[560px]:max-w-full max-[560px]:rounded-none max-[560px]:border-none',
  header: 'flex flex-shrink-0 items-center justify-between border-b border-border px-5 py-4 max-[560px]:px-4 max-[560px]:py-3.5',
  title: 'm-0 flex items-center gap-2 text-base font-bold text-foreground [&>i]:text-[20px] [&>i]:text-primary',
  closeBtn: 'cursor-pointer rounded p-1 text-lg text-muted-foreground transition-colors hover:bg-accent',
  body: 'flex flex-col gap-3 overflow-y-auto px-5 pb-5 pt-4 max-[560px]:px-4 max-[560px]:pb-[18px] max-[560px]:pt-3.5',
  toolbar: 'flex justify-between gap-2',
  toolbarHint: 'm-0 self-center text-[13px] text-muted-foreground [&_code]:font-semibold [&_code]:text-foreground',
  toolbarActions: 'flex flex-shrink-0 gap-2',
  muted: 'py-6 text-center text-sm text-muted-foreground',
  primaryBtn: 'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent bg-primary px-3.5 py-[9px] text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
  ghostBtn: 'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-transparent px-3.5 py-[9px] text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
  list: 'm-0 flex list-none flex-col gap-2 p-0',
  item: 'flex items-center justify-between gap-3 rounded-[10px] border border-border bg-muted/40 p-3 max-[560px]:flex-col max-[560px]:items-stretch',
  itemMain: 'flex min-w-0 items-start gap-2.5',
  itemText: 'flex min-w-0 flex-col gap-0.5',
  itemTitle: 'text-sm text-foreground',
  itemMeta: 'text-xs text-muted-foreground',
  reason: 'mt-0.5 text-xs text-destructive',
  badge: 'flex-shrink-0 whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold uppercase tracking-wide',
  draft: 'bg-muted text-muted-foreground',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
  actions: 'flex flex-shrink-0 gap-1 max-[560px]:justify-end',
  iconBtn: 'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border bg-transparent text-[15px] text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40',
  approve: 'hover:!bg-emerald-100 hover:!text-emerald-700 dark:hover:!bg-emerald-500/20 dark:hover:!text-emerald-400',
  reject: 'hover:!bg-amber-100 hover:!text-amber-700 dark:hover:!bg-amber-500/20 dark:hover:!text-amber-400',
  danger: 'hover:!bg-red-100 hover:!text-red-700 dark:hover:!bg-red-500/20 dark:hover:!text-red-400',
  label: 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground',
  input: 'rounded-lg border border-input bg-background px-[11px] py-[9px] text-sm text-foreground outline-none transition-colors focus:border-ring',
  textarea: 'resize-y rounded-lg border border-input bg-background px-[11px] py-[9px] text-sm text-foreground outline-none transition-colors focus:border-ring',
  colorInput: 'h-[38px] w-full cursor-pointer rounded-lg border border-input bg-background p-0.5',
  colorDot: 'mt-1 h-3.5 w-3.5 flex-shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]',
  dropzone: 'cursor-pointer rounded-[10px] border-[1.5px] border-dashed border-input bg-background transition-colors hover:border-ring',
  dropzoneActive: 'border-ring bg-accent',
  dropzoneHint: 'flex aspect-video flex-col items-center justify-center gap-2 p-4 text-center text-[13px] font-medium text-muted-foreground [&>i]:text-[28px] [&>i]:text-primary',
  imagePreviewWrap: 'relative aspect-video w-full',
  imagePreview: 'block h-full w-full rounded-[9px] object-cover',
  imageRemove: 'absolute right-2 top-2 flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-full border-none bg-black/60 text-base text-white hover:bg-black/85',
  fieldHint: 'text-[11px] font-medium text-muted-foreground',
  recurrence: 'm-0 flex flex-col gap-3 rounded-[10px] border border-border px-3.5 pb-3.5 pt-3 [&>legend]:px-1.5 [&>legend]:text-xs [&>legend]:font-bold [&>legend]:uppercase [&>legend]:tracking-wide [&>legend]:text-muted-foreground',
  row: 'grid grid-cols-2 gap-3 max-[560px]:grid-cols-1',
  checks: 'flex flex-wrap gap-5',
  check: 'flex cursor-pointer items-center gap-[7px] text-[13px] font-medium text-foreground',
  formActions: 'mt-1 flex justify-end gap-2',
  backBtn: 'inline-flex cursor-pointer rounded-md border-none bg-transparent px-1 py-0.5 text-lg text-muted-foreground transition-colors hover:bg-accent',
  menu: 'grid grid-cols-2 gap-3 max-[560px]:grid-cols-1',
  menuCard: 'flex cursor-pointer flex-col gap-1 rounded-xl border border-border bg-muted/40 p-4 text-left transition-colors hover:border-ring hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 [&>i]:text-2xl [&>i]:text-primary',
  menuTitle: 'text-[15px] font-bold text-foreground',
  menuDesc: 'text-xs text-muted-foreground',
  userForm: 'flex flex-col gap-3 rounded-[10px] border border-border bg-muted/40 p-3.5',
  checkInline: 'self-end pb-[9px]',
  userControls: 'flex flex-shrink-0 flex-wrap items-center gap-3 max-[560px]:justify-between',
  smallSelect: 'cursor-pointer rounded-lg border border-input bg-background px-2 py-1.5 text-[13px] text-foreground',
  filters: 'flex flex-wrap items-center gap-2',
  filterInput: 'min-w-0 flex-[1_1_160px] rounded-lg border border-input bg-background px-2.5 py-2 text-[13px] text-foreground',
  userItemCol: '!flex-col !items-stretch',
  userTop: 'flex items-center justify-between gap-3',
  churchRow: 'mt-2.5 flex flex-col gap-2 border-t border-dashed border-border pt-2.5',
  churchRowLabel: 'text-xs font-semibold text-muted-foreground',
  churchPicker: 'flex flex-col gap-2',
  churchGrid: 'grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-3.5 gap-y-1.5',
  statGrid: 'grid grid-cols-3 gap-2.5 max-[560px]:grid-cols-2',
  statCard: 'flex flex-col gap-0.5 rounded-[10px] border border-border bg-muted/40 p-3.5',
  statNum: 'text-2xl font-bold text-primary',
  statLabel: 'text-xs text-muted-foreground',
  reportSection: 'flex flex-col gap-2',
  reportHeading: 'mb-0 mt-1 text-[13px] font-bold uppercase tracking-wide text-muted-foreground',
  barList: 'm-0 flex list-none flex-col gap-1 p-0',
  barRow: 'flex justify-between rounded-lg border border-border bg-muted/40 px-3 py-[7px] text-[13px] text-foreground',
  barLabel: 'min-w-0 truncate pr-2',
  barValue: 'font-bold text-primary',
}

const STATUS_META = {
  rascunho: { label: 'Rascunho', cls: 'draft' },
  pendente: { label: 'Pendente', cls: 'pending' },
  publicado: { label: 'Publicado', cls: 'published' },
  rejeitado: { label: 'Rejeitado', cls: 'rejected' },
}

const CATEGORIES = Object.keys(CATEGORY_META)

// Converte ISO/timestamp para os formatos de <input type="date"> e "time".
function toDateInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function toTimeInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
// Combina data (YYYY-MM-DD) + hora (HH:mm) num ISO; hora vazia → 00:00.
function combineDateTime(date, time) {
  if (!date) return null
  return new Date(`${date}T${time || '00:00'}`).toISOString()
}

const emptyForm = {
  title: '',
  description: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  allDay: false,
  location: '',
  community: DEFAULT_CHURCH,
  category: 'evento',
  isPrivate: false,
  privacyTag: '',
  bannerUrl: '',
  seriesId: null,
  // Recorrência (apenas na criação).
  recurrenceType: 'unique', // 'unique' | 'recurrent'
  frequency: 'weekly', // 'daily' | 'weekly' | 'monthly'
  interval: 1,
  recEndType: 'never', // 'never' | 'count' | 'date'
  recEndCount: '',
  recEndDate: '',
}

// Imagem de evento: limites espelhados no backend (PNG/JPG, ≤5MB).
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const emptyUser = { email: '', name: '', role: 'editor', canViewPrivate: false, churches: null, privacyTags: null }

const emptyChurch = { name: '', externalId: '', address: '', postalCode: '' }
const emptyCategory = { slug: '', label: '', color: '#F5A800', sortOrder: '' }
const emptyPrivacyTag = { name: '' }

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'aprovador', label: 'Aprovador' },
  { value: 'editor', label: 'Editor' },
  { value: 'visitante', label: 'Visitante' },
]
const ROLE_VALUES = ROLE_OPTIONS.map((r) => r.value)

// Papéis limitados por igreja (mostram o seletor de igrejas).
const SCOPED_ROLES = ['aprovador', 'editor']
// Papéis que veem sempre eventos privados ("ver tudo").
const SEES_ALL_PRIVATE = ['admin', 'visitante']

// Descarrega texto como ficheiro (BOM UTF-8 para o Excel abrir bem os acentos).
function downloadCsv(content, filename) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Lê linhas "Nome;email;role" (aceita ; ou , como separador). Ignora o
// cabeçalho e linhas sem email válido. Papel inválido/ausente → "visitante".
function parseUserCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const out = []
  for (const line of lines) {
    const [name = '', email = '', role = ''] = line
      .split(/[;,]/)
      .map((c) => c.trim())
    if (!email.includes('@')) continue // salta cabeçalho e linhas inválidas
    const normalizedRole = ROLE_VALUES.includes(role.toLowerCase())
      ? role.toLowerCase()
      : 'visitante'
    out.push({ name, email, role: normalizedRole })
  }
  return out
}

// Secções do painel de gestão (menu principal).
const SECTION = {
  home: { icon: 'ti-layout-grid', title: 'Gestão da agenda' },
  events: { icon: 'ti-calendar-event', title: 'Gestão de eventos' },
  form: { icon: 'ti-calendar-plus', title: 'Evento' },
  users: { icon: 'ti-users', title: 'Gestão de utilizadores' },
  churches: { icon: 'ti-building-church', title: 'Gestão de igrejas' },
  categories: { icon: 'ti-tags', title: 'Gestão de categorias' },
  privacyTags: { icon: 'ti-shield-lock', title: 'Etiquetas de privacidade' },
  api: { icon: 'ti-plug-connected', title: 'Configurar API externa' },
  reports: { icon: 'ti-chart-bar', title: 'Relatórios' },
}

function eventToForm(evt) {
  return {
    title: evt.title ?? '',
    description: evt.description ?? '',
    startDate: toDateInput(evt.startDatetime),
    startTime: toTimeInput(evt.startDatetime),
    endDate: toDateInput(evt.endDatetime),
    endTime: toTimeInput(evt.endDatetime),
    allDay: !!evt.allDay,
    location: evt.location ?? '',
    community: evt.community ?? DEFAULT_CHURCH,
    category: evt.category ?? 'evento',
    isPrivate: !!evt.isPrivate,
    privacyTag: evt.privacyTag ?? '',
    bannerUrl: evt.bannerUrl ?? '',
    seriesId: evt.seriesId ?? null,
    // Recorrência não é reaplicada na edição (usa-se o âmbito "série").
    recurrenceType: 'unique',
    frequency: 'weekly',
    interval: 1,
    recEndType: 'never',
    recEndCount: '',
    recEndDate: '',
  }
}

/**
 * ChurchAccessPicker — escolhe as igrejas a que um aprovador ou editor tem
 * acesso no SoR. `value === null` significa "todas as igrejas" (sem restrição).
 */
function ChurchAccessPicker({ value, onChange, disabled, names = CHURCH_NAMES }) {
  const all = value === null
  const selected = value ?? []
  const toggleAll = () => onChange(all ? [] : null)
  const toggle = (name) => {
    const set = new Set(selected)
    if (set.has(name)) set.delete(name)
    else set.add(name)
    onChange([...set])
  }
  return (
    <div className={styles.churchPicker}>
      <label className={styles.check}>
        <input type="checkbox" checked={all} disabled={disabled} onChange={toggleAll} />
        Todas as igrejas
      </label>
      {!all && (
        <div className={styles.churchGrid}>
          {names.map((name) => (
            <label key={name} className={styles.check}>
              <input
                type="checkbox"
                checked={selected.includes(name)}
                disabled={disabled}
                onChange={() => toggle(name)}
              />
              {name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * PrivacyTagPicker — escolhe as etiquetas de privacidade que um utilizador pode
 * ver. `value === null` significa "todas as etiquetas" (sem restrição).
 */
function PrivacyTagPicker({ value, onChange, disabled, tags }) {
  const all = value === null
  const selected = value ?? []
  const toggleAll = () => onChange(all ? [] : null)
  const toggle = (name) => {
    const set = new Set(selected)
    if (set.has(name)) set.delete(name)
    else set.add(name)
    onChange([...set])
  }
  return (
    <div className={styles.churchPicker}>
      <label className={styles.check}>
        <input type="checkbox" checked={all} disabled={disabled} onChange={toggleAll} />
        Todas as etiquetas
      </label>
      {!all &&
        (tags.length === 0 ? (
          <span className={styles.fieldHint}>
            Ainda não há etiquetas. Crie-as em “Etiquetas de privacidade”.
          </span>
        ) : (
          <div className={styles.churchGrid}>
            {tags.map((t) => (
              <label key={t.id} className={styles.check}>
                <input
                  type="checkbox"
                  checked={selected.includes(t.name)}
                  disabled={disabled}
                  onChange={() => toggle(t.name)}
                />
                {t.name}
              </label>
            ))}
          </div>
        ))}
    </div>
  )
}

/**
 * ManagePanel — backoffice da agenda (System of Record).
 * Lista, cria/edita eventos e gere o fluxo de aprovação conforme o papel.
 */
export default function ManagePanel({ onClose, initialView = 'home' }) {
  const { user, hasRole } = useAuth()
  const containerRef = useModalA11y(onClose)

  const isAdmin = hasRole('admin')
  // Quem pode gerir/moderar eventos: admin (todas as igrejas) e aprovador/editor
  // (limitados às suas igrejas). O acesso por igreja é revalidado no backend.
  const isManager = hasRole('admin', 'aprovador', 'editor')
  const myChurches =
    Array.isArray(user?.churches) && user.churches.length > 0 ? user.churches : null
  const canAccessChurch = (community) =>
    isAdmin || myChurches === null || myChurches.includes(community)

  // Lista de igrejas da BD (partilhada/cacheada), com fallback à lista fixa
  // enquanto o pedido não resolve ou se falhar.
  const { churches: dbChurches } = useChurches()
  const churchList = dbChurches.length ? dbChurches : CHURCHES
  const churchNames = churchList.map((c) => c.name)
  // Lista de categorias da BD (partilhada/cacheada).
  const { categories: dbCategories } = useCategories()
  // Opções de categoria para o formulário (BD com fallback às fixas).
  const categoryOptions = dbCategories.length
    ? dbCategories.map((c) => ({ value: c.slug, label: c.label }))
    : CATEGORIES.map((k) => ({ value: k, label: CATEGORY_META[k].label }))
  // Lista de etiquetas de privacidade da BD (partilhada/cacheada).
  const { privacyTags: dbPrivacyTags } = usePrivacyTags()

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState(initialView) // 'home'|'events'|'form'|'users'|'api'|'reports'
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  // Upload de imagem do evento.
  const [uploadingImage, setUploadingImage] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  // Ao editar uma ocorrência de uma série, aplicar a toda a série.
  const [applyToSeries, setApplyToSeries] = useState(false)
  const [integration, setIntegration] = useState(null) // config da inChurch
  const [syncing, setSyncing] = useState(false) // sincronização inChurch a decorrer
  const [users, setUsers] = useState([])
  const [newUser, setNewUser] = useState(emptyUser)
  const [report, setReport] = useState(null)
  // Gestão de igrejas (admin).
  const [churchForm, setChurchForm] = useState(emptyChurch)
  const [editingChurchId, setEditingChurchId] = useState(null)
  // Gestão de categorias (admin).
  const [categoryForm, setCategoryForm] = useState(emptyCategory)
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  // Gestão de etiquetas de privacidade (admin).
  const [privacyTagForm, setPrivacyTagForm] = useState(emptyPrivacyTag)
  // Filtros de gestão (Update 1 e 2).
  const [eventFilters, setEventFilters] = useState({ title: '', community: 'Todas', date: '' })
  const [userFilters, setUserFilters] = useState({ q: '', role: 'Todos', status: 'Todos' })

  const section = SECTION[view] ?? SECTION.home

  // Eventos filtrados por título, igreja e data.
  const visibleEvents = useMemo(() => {
    const title = eventFilters.title.trim().toLowerCase()
    return events.filter((e) => {
      if (title && !(e.title ?? '').toLowerCase().includes(title)) return false
      if (eventFilters.community !== 'Todas' && e.community !== eventFilters.community) return false
      if (eventFilters.date && e.date !== eventFilters.date) return false
      return true
    })
  }, [events, eventFilters])

  // Utilizadores filtrados por nome/email, papel e estado.
  const visibleUsers = useMemo(() => {
    const q = userFilters.q.trim().toLowerCase()
    return users.filter((u) => {
      if (q && !`${u.name ?? ''} ${u.email}`.toLowerCase().includes(q)) return false
      if (userFilters.role !== 'Todos' && u.role !== userFilters.role) return false
      if (userFilters.status === 'Ativos' && !u.isActive) return false
      if (userFilters.status === 'Suspensos' && u.isActive) return false
      return true
    })
  }, [users, userFilters])

  // Igrejas que o utilizador atual pode escolher ao criar/editar eventos.
  // (derivação simples — o React Compiler trata da memoização)
  const allowedChurches =
    isAdmin || !Array.isArray(user?.churches) || user.churches.length === 0
      ? churchList
      : churchList.filter((c) => user.churches.includes(c.name))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setEvents(await eventsService.listEvents())
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Carregamento inicial da lista de gestão.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const setField = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const openNew = () => {
    setForm(emptyForm)
    setEditingId(null)
    setApplyToSeries(false)
    setView('form')
  }

  const openEdit = (evt) => {
    setForm(eventToForm(evt))
    setEditingId(evt.id)
    setApplyToSeries(false)
    setView('form')
  }

  const goHome = () => setView('home')

  const openEvents = () => setView('events')

  const openApi = async () => {
    setBusy(true)
    try {
      setIntegration(await eventsService.getIntegration())
      setView('api')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const loadUsers = useCallback(async () => {
    setBusy(true)
    try {
      setUsers(await eventsService.listUsers())
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }, [])

  const openUsers = async () => {
    await loadUsers()
    setView('users')
  }

  const openReports = async () => {
    setBusy(true)
    try {
      setReport(await eventsService.getReportSummary())
      setView('reports')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  // ── Gestão de igrejas (admin) ──────────────────────────────────
  const openChurches = () => {
    setChurchForm(emptyChurch)
    setEditingChurchId(null)
    setView('churches')
  }

  const setChurchField = (key) => (e) =>
    setChurchForm((c) => ({ ...c, [key]: e.target.value }))

  const openEditChurch = (church) => {
    setChurchForm({
      name: church.name ?? '',
      externalId: church.externalId ?? '',
      address: church.address ?? '',
      postalCode: church.postalCode ?? '',
    })
    setEditingChurchId(church.id)
  }

  const cancelChurchEdit = () => {
    setChurchForm(emptyChurch)
    setEditingChurchId(null)
  }

  const handleSaveChurch = async (e) => {
    e.preventDefault()
    if (!churchForm.name.trim()) {
      toast.error('O nome da igreja é obrigatório.')
      return
    }
    const ext = String(churchForm.externalId ?? '').trim()
    const payload = {
      name: churchForm.name.trim(),
      externalId: ext === '' ? null : ext,
      address: churchForm.address.trim() || null,
      postalCode: churchForm.postalCode.trim() || null,
    }
    setBusy(true)
    try {
      if (editingChurchId) {
        await eventsService.updateChurch(editingChurchId, payload)
        toast.success('Igreja atualizada.')
      } else {
        await eventsService.createChurch(payload)
        toast.success('Igreja criada.')
      }
      await invalidateChurches()
      cancelChurchEdit()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteChurch = (church) => {
    if (!window.confirm(`Eliminar "${church.name}"? Esta ação é irreversível.`)) return
    setBusy(true)
    eventsService
      .deleteChurch(church.id)
      .then(() => {
        toast.success('Igreja eliminada.')
        if (editingChurchId === church.id) cancelChurchEdit()
        return invalidateChurches()
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setBusy(false))
  }

  // ── Gestão de categorias (admin) ───────────────────────────────
  const openCategories = () => {
    setCategoryForm(emptyCategory)
    setEditingCategoryId(null)
    setView('categories')
  }

  const setCategoryField = (key) => (e) =>
    setCategoryForm((c) => ({ ...c, [key]: e.target.value }))

  const openEditCategory = (category) => {
    setCategoryForm({
      slug: category.slug ?? '',
      label: category.label ?? '',
      color: category.color ?? '#F5A800',
      sortOrder: category.sortOrder ?? '',
    })
    setEditingCategoryId(category.id)
  }

  const cancelCategoryEdit = () => {
    setCategoryForm(emptyCategory)
    setEditingCategoryId(null)
  }

  const handleSaveCategory = async (e) => {
    e.preventDefault()
    if (!categoryForm.label.trim()) {
      toast.error('O nome da categoria é obrigatório.')
      return
    }
    if (!editingCategoryId && !categoryForm.slug.trim()) {
      toast.error('O identificador é obrigatório.')
      return
    }
    setBusy(true)
    try {
      if (editingCategoryId) {
        await eventsService.updateCategory(editingCategoryId, {
          label: categoryForm.label.trim(),
          color: categoryForm.color || null,
          sortOrder: categoryForm.sortOrder,
        })
        toast.success('Categoria atualizada.')
      } else {
        await eventsService.createCategory({
          slug: categoryForm.slug.trim().toLowerCase(),
          label: categoryForm.label.trim(),
          color: categoryForm.color || null,
          sortOrder: categoryForm.sortOrder,
        })
        toast.success('Categoria criada.')
      }
      await invalidateCategories()
      cancelCategoryEdit()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteCategory = (category) => {
    if (!window.confirm(`Eliminar a categoria "${category.label}"?`)) return
    setBusy(true)
    eventsService
      .deleteCategory(category.id)
      .then(() => {
        toast.success('Categoria eliminada.')
        if (editingCategoryId === category.id) cancelCategoryEdit()
        return invalidateCategories()
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setBusy(false))
  }

  // ── Gestão de etiquetas de privacidade (admin) ─────────────────
  const openPrivacyTags = () => {
    setPrivacyTagForm(emptyPrivacyTag)
    setView('privacyTags')
  }

  const setPrivacyTagField = (key) => (e) =>
    setPrivacyTagForm((t) => ({ ...t, [key]: e.target.value }))

  const handleSavePrivacyTag = async (e) => {
    e.preventDefault()
    if (!privacyTagForm.name.trim()) {
      toast.error('O nome da etiqueta é obrigatório.')
      return
    }
    setBusy(true)
    try {
      await eventsService.createPrivacyTag({ name: privacyTagForm.name.trim() })
      toast.success('Etiqueta criada.')
      await invalidatePrivacyTags()
      setPrivacyTagForm(emptyPrivacyTag)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDeletePrivacyTag = (tag) => {
    if (!window.confirm(`Eliminar a etiqueta "${tag.name}"?`)) return
    setBusy(true)
    eventsService
      .deletePrivacyTag(tag.id)
      .then(() => {
        toast.success('Etiqueta eliminada.')
        return invalidatePrivacyTags()
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setBusy(false))
  }

  const setNewUserField = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setNewUser((u) => ({ ...u, [key]: value }))
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!newUser.email.trim()) {
      toast.error('O email é obrigatório.')
      return
    }
    setBusy(true)
    try {
      await eventsService.createUser({
        email: newUser.email.trim(),
        name: newUser.name.trim() || null,
        role: newUser.role,
        canViewPrivate: newUser.canViewPrivate,
        churches: SCOPED_ROLES.includes(newUser.role) ? newUser.churches : null,
        privacyTags:
          SEES_ALL_PRIVATE.includes(newUser.role) || newUser.canViewPrivate
            ? newUser.privacyTags
            : null,
      })
      toast.success('Utilizador criado.')
      setNewUser(emptyUser)
      await loadUsers()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const importInputRef = useRef(null)
  const imageInputRef = useRef(null)

  // Valida e carrega uma imagem (PNG/JPG, ≤5MB) para o backend; guarda a URL.
  const handleImageFile = async (file) => {
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Formato inválido. Apenas PNG ou JPG.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Imagem demasiado grande (máx. 5MB).')
      return
    }
    setUploadingImage(true)
    try {
      const url = await eventsService.uploadEventImage(file)
      setForm((f) => ({ ...f, bannerUrl: url }))
      toast.success('Imagem carregada.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const downloadUserTemplate = () => {
    const content = [
      'Nome;email;role',
      'João Exemplo;joao@cclx.pt;editor',
      ';maria@cclx.pt;visitante',
    ].join('\r\n')
    downloadCsv(content, 'modelo-utilizadores.csv')
  }

  const handleImportUsers = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reimportar o mesmo ficheiro
    if (!file) return
    let text
    try {
      text = await file.text()
    } catch {
      toast.error('Não foi possível ler o ficheiro.')
      return
    }
    const rows = parseUserCsv(text)
    if (!rows.length) {
      toast.error('Sem linhas válidas. Formato esperado: Nome;email;role')
      return
    }
    setBusy(true)
    let created = 0
    const errors = []
    for (const row of rows) {
      try {
        await eventsService.createUser({
          email: row.email,
          name: row.name || null,
          role: row.role,
          canViewPrivate: SEES_ALL_PRIVATE.includes(row.role),
          churches: null,
          privacyTags: null,
        })
        created += 1
      } catch (err) {
        errors.push(`${row.email}: ${err.message}`)
      }
    }
    setBusy(false)
    await loadUsers()
    if (created) toast.success(`${created} utilizador(es) importado(s).`)
    if (errors.length) {
      toast.error(`${errors.length} linha(s) com erro. Ex.: ${errors[0]}`)
    }
  }

  const handleUserPatch = async (u, patch) => {
    setBusy(true)
    try {
      const updated = await eventsService.updateUser(u.id, patch)
      setUsers((list) => list.map((x) => (x.id === u.id ? updated : x)))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteUser = (u) => {
    if (!window.confirm(`Eliminar "${u.email}"? Esta ação é irreversível.`)) return
    setBusy(true)
    eventsService
      .deleteUser(u.id)
      .then(() => {
        toast.success('Utilizador eliminado.')
        return loadUsers()
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setBusy(false))
  }

  const setIntegrationField = (key) => (e) =>
    setIntegration((cfg) => ({ ...cfg, [key]: e.target.checked }))

  const setIntegrationInterval = (e) => {
    const value = e.target.value
    setIntegration((cfg) => ({ ...cfg, intervalMinutes: value === '' ? '' : Number(value) }))
  }

  const handleSaveIntegration = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const interval = Number(integration.intervalMinutes)
      const saved = await eventsService.updateIntegration({
        enabled: integration.enabled,
        intervalMinutes: Number.isFinite(interval) && interval > 0 ? interval : 30,
      })
      setIntegration(saved)
      toast.success('Integração atualizada.')
      setView('home')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const result = await eventsService.syncIntegration()
      if (result?.ok) {
        toast.success(
          `Sincronização concluída: ${result.fetched} eventos ` +
            `(+${result.inserted} / ~${result.updated} / -${result.deleted}).`
        )
      } else if (result?.skipped) {
        const reasons = {
          disabled: 'Integração desativada.',
          'not-configured': 'Credenciais da inChurch em falta no servidor.',
          running: 'Já existe uma sincronização a decorrer.',
          'not-due': 'Ainda não passou o intervalo configurado.',
        }
        toast.message(reasons[result.skipped] ?? 'Sincronização ignorada.')
      } else {
        toast.error(result?.error ?? 'Falha na sincronização.')
      }
      // Atualiza o estado mostrado (última sincronização).
      setIntegration(await eventsService.getIntegration())
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const buildPayload = () => {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      startDatetime: combineDateTime(form.startDate, form.startTime),
      endDatetime: form.endDate ? combineDateTime(form.endDate, form.endTime) : null,
      allDay: form.allDay,
      location: form.location.trim() || null,
      community: form.community.trim() || DEFAULT_CHURCH,
      category: form.category,
      isPrivate: form.isPrivate,
      // Etiqueta só se aplica a eventos privados.
      privacyTag: form.isPrivate ? form.privacyTag || null : null,
      bannerUrl: form.bannerUrl.trim() || null,
    }
    // Recorrência só na criação de um novo evento recorrente.
    if (!editingId && form.recurrenceType === 'recurrent') {
      const end =
        form.recEndType === 'count'
          ? { type: 'count', count: Number(form.recEndCount) }
          : form.recEndType === 'date'
            ? { type: 'date', date: form.recEndDate }
            : { type: 'never' }
      payload.recurrence = {
        frequency: form.frequency,
        interval: Number(form.interval) || 1,
        end,
      }
    }
    return payload
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.startDate) {
      toast.error('Título e data de início são obrigatórios.')
      return
    }
    const startIso = combineDateTime(form.startDate, form.startTime)
    const endIso = form.endDate ? combineDateTime(form.endDate, form.endTime) : null
    if (endIso && new Date(endIso) < new Date(startIso)) {
      toast.error('A data de fim não pode ser anterior à de início.')
      return
    }
    // Etiqueta de privacidade obrigatória quando o evento é privado.
    if (form.isPrivate && !form.privacyTag) {
      toast.error('Selecione uma etiqueta de privacidade para o evento privado.')
      return
    }
    // Validação da recorrência (apenas na criação).
    if (!editingId && form.recurrenceType === 'recurrent') {
      if (form.recEndType === 'count') {
        const n = Number(form.recEndCount)
        if (!Number.isInteger(n) || n < 1) {
          toast.error('Indique um número de ocorrências válido.')
          return
        }
      }
      if (form.recEndType === 'date') {
        if (!form.recEndDate) {
          toast.error('Indique a data de fim da recorrência.')
          return
        }
        if (new Date(form.recEndDate) < new Date(form.startDate)) {
          toast.error('A data de fim da recorrência não pode ser anterior ao início.')
          return
        }
      }
    }
    setBusy(true)
    try {
      const payload = buildPayload()
      if (editingId) {
        const scope = applyToSeries && form.seriesId ? 'series' : undefined
        await eventsService.updateEvent(editingId, payload, { scope })
        toast.success(scope === 'series' ? 'Série atualizada.' : 'Evento atualizado.')
      } else {
        await eventsService.createEvent(payload)
        toast.success(
          form.recurrenceType === 'recurrent' ? 'Série de rascunhos criada.' : 'Rascunho criado.'
        )
      }
      await load()
      setView('events')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const runAction = async (fn, okMsg) => {
    setBusy(true)
    try {
      await fn()
      toast.success(okMsg)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = (evt) =>
    runAction(() => eventsService.submitEvent(evt.id), 'Submetido para aprovação.')

  const handleApprove = (evt) =>
    runAction(() => eventsService.approveEvent(evt.id), 'Evento publicado.')

  const handleReject = (evt) => {
    const reason = window.prompt('Motivo da rejeição:')
    if (reason === null) return
    if (!reason.trim()) {
      toast.error('É obrigatório indicar o motivo.')
      return
    }
    runAction(() => eventsService.rejectEvent(evt.id, reason), 'Evento rejeitado.')
  }

  const handleDelete = (evt) => {
    if (!window.confirm(`Eliminar "${evt.title}"? Esta ação é irreversível.`)) return
    let scope
    if (evt.seriesId) {
      scope = window.confirm(
        'Este evento faz parte de uma série recorrente. Eliminar TODA a série?\n\nOK = série inteira • Cancelar = apenas este evento'
      )
        ? 'series'
        : undefined
    }
    runAction(
      () => eventsService.deleteEvent(evt.id, { scope }),
      scope === 'series' ? 'Série eliminada.' : 'Evento eliminado.'
    )
  }

  // Permissões de UI (espelham o backend; o acesso por igreja é revalidado lá).
  const canEdit = (evt) => isManager && canAccessChurch(evt.community)
  const canSubmit = (evt) => ['rascunho', 'rejeitado'].includes(evt.status) && canEdit(evt)
  const canModerate = (evt) =>
    isManager && evt.status === 'pendente' && canAccessChurch(evt.community)
  const canDelete = (evt) => isManager && canAccessChurch(evt.community)

  return (
    <motion.div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Gestão da agenda"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className={styles.panel}
        ref={containerRef}
        tabIndex={-1}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>
            {view !== 'home' && (
              <button
                type="button"
                className={styles.backBtn}
                onClick={goHome}
                aria-label="Voltar ao menu"
              >
                <i className="ti ti-arrow-left" aria-hidden="true" />
              </button>
            )}
            <i className={`ti ${section.icon}`} aria-hidden="true" />
            {view === 'form' ? (editingId ? 'Editar evento' : 'Novo evento') : section.title}
          </h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {view === 'home' ? (
          <div className={styles.body}>
            <p className={styles.muted}>O que pretendes gerir?</p>
            <div className={styles.menu}>
              {isAdmin && (
                <button className={styles.menuCard} onClick={openUsers} disabled={busy}>
                  <i className="ti ti-users" aria-hidden="true" />
                  <span className={styles.menuTitle}>Gestão de utilizadores</span>
                  <span className={styles.menuDesc}>
                    Papéis, acesso a privados e estado das contas.
                  </span>
                </button>
              )}
              {isAdmin && (
                <button className={styles.menuCard} onClick={openChurches} disabled={busy}>
                  <i className="ti ti-building-church" aria-hidden="true" />
                  <span className={styles.menuTitle}>Gestão de igrejas</span>
                  <span className={styles.menuDesc}>
                    Nome, ID da inChurch, morada e código postal.
                  </span>
                </button>
              )}
              {isAdmin && (
                <button className={styles.menuCard} onClick={openCategories} disabled={busy}>
                  <i className="ti ti-tags" aria-hidden="true" />
                  <span className={styles.menuTitle}>Gestão de categorias</span>
                  <span className={styles.menuDesc}>
                    Nome, cor e ordem das categorias dos eventos.
                  </span>
                </button>
              )}
              {isAdmin && (
                <button className={styles.menuCard} onClick={openPrivacyTags} disabled={busy}>
                  <i className="ti ti-shield-lock" aria-hidden="true" />
                  <span className={styles.menuTitle}>Etiquetas de privacidade</span>
                  <span className={styles.menuDesc}>
                    Grupos de visibilidade dos eventos privados.
                  </span>
                </button>
              )}
              <button className={styles.menuCard} onClick={openEvents} disabled={busy}>
                <i className="ti ti-calendar-event" aria-hidden="true" />
                <span className={styles.menuTitle}>Gestão de eventos</span>
                <span className={styles.menuDesc}>Criar, editar, submeter e aprovar eventos.</span>
              </button>
              {isAdmin && (
                <button className={styles.menuCard} onClick={openApi} disabled={busy}>
                  <i className="ti ti-plug-connected" aria-hidden="true" />
                  <span className={styles.menuTitle}>Configurar API externa</span>
                  <span className={styles.menuDesc}>Integração com a inChurch.</span>
                </button>
              )}
              {isManager && (
                <button className={styles.menuCard} onClick={openReports} disabled={busy}>
                  <i className="ti ti-chart-bar" aria-hidden="true" />
                  <span className={styles.menuTitle}>Relatórios</span>
                  <span className={styles.menuDesc}>Resumo e atividade da agenda.</span>
                </button>
              )}
            </div>
          </div>
        ) : view === 'events' ? (
          <div className={styles.body}>
            <div className={styles.toolbar}>
              <button className={styles.primaryBtn} onClick={openNew}>
                <i className="ti ti-plus" aria-hidden="true" />
                <span>Novo evento</span>
              </button>
              <button className={styles.ghostBtn} onClick={load} disabled={loading}>
                <i className="ti ti-refresh" aria-hidden="true" />
                <span>Atualizar</span>
              </button>
            </div>

            <div className={styles.filters}>
              <input
                className={styles.filterInput}
                placeholder="Filtrar por título…"
                value={eventFilters.title}
                onChange={(e) => setEventFilters((f) => ({ ...f, title: e.target.value }))}
              />
              <select
                className={styles.filterInput}
                value={eventFilters.community}
                onChange={(e) => setEventFilters((f) => ({ ...f, community: e.target.value }))}
                title="Igreja"
              >
                <option value="Todas">Todas as igrejas</option>
                {churchNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className={styles.filterInput}
                value={eventFilters.date}
                onChange={(e) => setEventFilters((f) => ({ ...f, date: e.target.value }))}
                title="Data"
              />
              {(eventFilters.title || eventFilters.community !== 'Todas' || eventFilters.date) && (
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => setEventFilters({ title: '', community: 'Todas', date: '' })}
                >
                  <i className="ti ti-x" aria-hidden="true" />
                  <span>Limpar</span>
                </button>
              )}
            </div>

            {loading ? (
              <p className={styles.muted}>A carregar…</p>
            ) : events.length === 0 ? (
              <p className={styles.muted}>Ainda não há eventos. Cria o primeiro.</p>
            ) : visibleEvents.length === 0 ? (
              <p className={styles.muted}>Nenhum evento corresponde aos filtros.</p>
            ) : (
              <ul className={styles.list}>
                {visibleEvents.map((evt) => {
                  const s = STATUS_META[evt.status] ?? STATUS_META.rascunho
                  return (
                    <li key={evt.id} className={styles.item}>
                      <div className={styles.itemMain}>
                        <span className={`${styles.badge} ${styles[s.cls]}`}>{s.label}</span>
                        <div className={styles.itemText}>
                          <strong className={styles.itemTitle}>{evt.title}</strong>
                          <span className={styles.itemMeta}>
                            {formatDateNumeric(evt.date)}
                            {evt.timeStart ? ` · ${evt.timeStart}` : ''} ·{' '}
                            {CATEGORY_META[evt.category]?.label ?? evt.category} · {evt.community}
                            {evt.isPrivate ? ' · privado' : ''}
                          </span>
                          {evt.status === 'rejeitado' && evt.rejectionReason && (
                            <span className={styles.reason}>
                              <i className="ti ti-message-2" aria-hidden="true" />{' '}
                              {evt.rejectionReason}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.actions}>
                        {canEdit(evt) && (
                          <button
                            className={styles.iconBtn}
                            onClick={() => openEdit(evt)}
                            disabled={busy}
                            title="Editar"
                          >
                            <i className="ti ti-pencil" aria-hidden="true" />
                          </button>
                        )}
                        {canSubmit(evt) && (
                          <button
                            className={styles.iconBtn}
                            onClick={() => handleSubmit(evt)}
                            disabled={busy}
                            title="Submeter para aprovação"
                          >
                            <i className="ti ti-send" aria-hidden="true" />
                          </button>
                        )}
                        {canModerate(evt) && (
                          <>
                            <button
                              className={`${styles.iconBtn} ${styles.approve}`}
                              onClick={() => handleApprove(evt)}
                              disabled={busy}
                              title="Aprovar"
                            >
                              <i className="ti ti-check" aria-hidden="true" />
                            </button>
                            <button
                              className={`${styles.iconBtn} ${styles.reject}`}
                              onClick={() => handleReject(evt)}
                              disabled={busy}
                              title="Rejeitar"
                            >
                              <i className="ti ti-ban" aria-hidden="true" />
                            </button>
                          </>
                        )}
                        {canDelete(evt) && (
                          <button
                            className={`${styles.iconBtn} ${styles.danger}`}
                            onClick={() => handleDelete(evt)}
                            disabled={busy}
                            title="Eliminar"
                          >
                            <i className="ti ti-trash" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : view === 'api' ? (
          <form className={styles.body} onSubmit={handleSaveIntegration}>
            <p className={styles.muted}>
              Os eventos da inChurch são sincronizados periodicamente para a base
              de dados (a agenda lê sempre da base de dados, não da API ao vivo).
              Quando desativada, a sincronização para e os eventos externos
              deixam de aparecer na agenda.
            </p>

            <div className={styles.checks}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={!!integration?.enabled}
                  onChange={setIntegrationField('enabled')}
                />
                Integração com a inChurch ativa
              </label>
            </div>

            <label className={styles.label}>
              Intervalo de sincronização (minutos)
              <input
                className={styles.input}
                type="number"
                min="1"
                max="1440"
                value={integration?.intervalMinutes ?? ''}
                onChange={setIntegrationInterval}
              />
            </label>

            <label className={styles.label}>
              Base URL (servidor)
              <input className={styles.input} value={integration?.baseUrl ?? ''} readOnly />
            </label>

            <p className={styles.muted}>
              <i
                className={`ti ${integration?.credentialsConfigured ? 'ti-check' : 'ti-alert-triangle'}`}
                aria-hidden="true"
              />{' '}
              {integration?.credentialsConfigured
                ? 'Credenciais configuradas no servidor.'
                : 'Credenciais em falta no servidor (.env).'}
            </p>

            <div className={styles.checks}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={handleSyncNow}
                disabled={syncing || !integration?.enabled || !integration?.credentialsConfigured}
              >
                <i className={`ti ${syncing ? 'ti-loader-2' : 'ti-refresh'}`} aria-hidden="true" />{' '}
                {syncing ? 'A sincronizar…' : 'Sincronizar agora'}
              </button>
            </div>

            {integration?.sync ? (
              <p className={styles.muted}>
                <i
                  className={`ti ${integration.sync.lastStatus === 'ok' ? 'ti-check' : 'ti-alert-triangle'}`}
                  aria-hidden="true"
                />{' '}
                {integration.sync.lastSyncAt
                  ? `Última sincronização: ${new Date(integration.sync.lastSyncAt).toLocaleString('pt-PT')}`
                  : 'Ainda sem sincronização concluída.'}
                {integration.sync.lastCounts
                  ? ` — ${integration.sync.lastCounts.fetched} eventos ` +
                    `(+${integration.sync.lastCounts.inserted} / ~${integration.sync.lastCounts.updated} / -${integration.sync.lastCounts.deleted}).`
                  : ''}
                {integration.sync.lastStatus === 'error' && integration.sync.lastError
                  ? ` Erro: ${integration.sync.lastError}`
                  : ''}
              </p>
            ) : (
              <p className={styles.muted}>Ainda sem sincronização registada.</p>
            )}

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={goHome}
                disabled={busy}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={busy || !integration}>
                {busy ? 'A guardar…' : 'Guardar'}
              </button>
            </div>
          </form>
        ) : view === 'users' ? (
          <div className={styles.body}>
            <div className={styles.toolbar}>
              <p className={styles.toolbarHint}>
                Importa vários utilizadores de um ficheiro CSV no formato{' '}
                <code>Nome;email;role</code>.
              </p>
              <div className={styles.toolbarActions}>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={downloadUserTemplate}
                  disabled={busy}
                >
                  <i className="ti ti-download" aria-hidden="true" />
                  <span>Modelo</span>
                </button>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => importInputRef.current?.click()}
                  disabled={busy}
                >
                  <i className="ti ti-upload" aria-hidden="true" />
                  <span>Importar</span>
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv"
                  hidden
                  onChange={handleImportUsers}
                />
              </div>
            </div>
            <form className={styles.userForm} onSubmit={handleCreateUser}>
              <div className={styles.row}>
                <label className={styles.label}>
                  Email *
                  <input
                    className={styles.input}
                    type="email"
                    value={newUser.email}
                    onChange={setNewUserField('email')}
                    placeholder="pessoa@cclx.pt"
                    required
                  />
                </label>
                <label className={styles.label}>
                  Nome
                  <input
                    className={styles.input}
                    value={newUser.name}
                    onChange={setNewUserField('name')}
                  />
                </label>
              </div>
              <div className={styles.row}>
                <label className={styles.label}>
                  Papel
                  <select
                    className={styles.input}
                    value={newUser.role}
                    onChange={setNewUserField('role')}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`${styles.check} ${styles.checkInline}`}>
                  <input
                    type="checkbox"
                    checked={SEES_ALL_PRIVATE.includes(newUser.role) || newUser.canViewPrivate}
                    disabled={SEES_ALL_PRIVATE.includes(newUser.role)}
                    onChange={setNewUserField('canViewPrivate')}
                  />
                  Pode ver eventos privados
                </label>
              </div>
              {SCOPED_ROLES.includes(newUser.role) && (
                <div className={styles.churchRow}>
                  <span className={styles.churchRowLabel}>Igrejas com acesso</span>
                  <ChurchAccessPicker
                    value={newUser.churches}
                    disabled={busy}
                    names={churchNames}
                    onChange={(churches) => setNewUser((u) => ({ ...u, churches }))}
                  />
                </div>
              )}
              {(SEES_ALL_PRIVATE.includes(newUser.role) || newUser.canViewPrivate) && (
                <div className={styles.churchRow}>
                  <span className={styles.churchRowLabel}>Etiquetas de privacidade visíveis</span>
                  <PrivacyTagPicker
                    value={newUser.privacyTags}
                    disabled={busy}
                    tags={dbPrivacyTags}
                    onChange={(privacyTags) => setNewUser((u) => ({ ...u, privacyTags }))}
                  />
                </div>
              )}
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn} disabled={busy}>
                  <i className="ti ti-user-plus" aria-hidden="true" />
                  <span>Criar utilizador</span>
                </button>
              </div>
            </form>

            <div className={styles.filters}>
              <input
                className={styles.filterInput}
                placeholder="Procurar nome ou email…"
                value={userFilters.q}
                onChange={(e) => setUserFilters((f) => ({ ...f, q: e.target.value }))}
              />
              <select
                className={styles.filterInput}
                value={userFilters.role}
                onChange={(e) => setUserFilters((f) => ({ ...f, role: e.target.value }))}
                title="Papel"
              >
                <option value="Todos">Todos os papéis</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select
                className={styles.filterInput}
                value={userFilters.status}
                onChange={(e) => setUserFilters((f) => ({ ...f, status: e.target.value }))}
                title="Estado"
              >
                <option value="Todos">Todos os estados</option>
                <option value="Ativos">Ativos</option>
                <option value="Suspensos">Suspensos</option>
              </select>
            </div>

            {users.length === 0 ? (
              <p className={styles.muted}>Sem utilizadores.</p>
            ) : visibleUsers.length === 0 ? (
              <p className={styles.muted}>Nenhum utilizador corresponde aos filtros.</p>
            ) : (
              <ul className={styles.list}>
                {visibleUsers.map((u) => (
                  <li
                    key={u.id}
                    className={`${styles.item} ${
                      SCOPED_ROLES.includes(u.role) ||
                      SEES_ALL_PRIVATE.includes(u.role) ||
                      u.canViewPrivate
                        ? styles.userItemCol
                        : ''
                    }`}
                  >
                    <div className={styles.userTop}>
                      <div className={styles.itemText}>
                        <strong className={styles.itemTitle}>{u.name || u.email}</strong>
                        <span className={styles.itemMeta}>
                          {u.email}
                          {u.isActive ? '' : ' · suspenso'}
                        </span>
                      </div>
                      <div className={styles.userControls}>
                        <select
                          className={styles.smallSelect}
                          value={u.role}
                          disabled={busy || u.id === user?.sub}
                          onChange={(e) => handleUserPatch(u, { role: e.target.value })}
                          title="Papel"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <label className={styles.check} title="Conta ativa">
                          <input
                            type="checkbox"
                            checked={u.isActive}
                            disabled={busy || u.id === user?.sub}
                            onChange={(e) => handleUserPatch(u, { isActive: e.target.checked })}
                          />
                          Ativo
                        </label>
                        <label className={styles.check} title="Acesso a eventos privados">
                          <input
                            type="checkbox"
                            checked={SEES_ALL_PRIVATE.includes(u.role) || u.canViewPrivate}
                            disabled={busy || SEES_ALL_PRIVATE.includes(u.role)}
                            onChange={(e) =>
                              handleUserPatch(u, { canViewPrivate: e.target.checked })
                            }
                          />
                          Privados
                        </label>
                        <button
                          className={`${styles.iconBtn} ${styles.danger}`}
                          onClick={() => handleDeleteUser(u)}
                          disabled={busy || u.id === user?.sub}
                          title="Eliminar"
                        >
                          <i className="ti ti-trash" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    {SCOPED_ROLES.includes(u.role) && (
                      <div className={styles.churchRow}>
                        <span className={styles.churchRowLabel}>Igrejas com acesso</span>
                        <ChurchAccessPicker
                          value={u.churches ?? null}
                          disabled={busy || u.id === user?.sub}
                          names={churchNames}
                          onChange={(churches) => handleUserPatch(u, { churches })}
                        />
                      </div>
                    )}
                    {(SEES_ALL_PRIVATE.includes(u.role) || u.canViewPrivate) && (
                      <div className={styles.churchRow}>
                        <span className={styles.churchRowLabel}>
                          Etiquetas de privacidade visíveis
                        </span>
                        <PrivacyTagPicker
                          value={u.privacyTags ?? null}
                          disabled={busy || u.id === user?.sub}
                          tags={dbPrivacyTags}
                          onChange={(privacyTags) => handleUserPatch(u, { privacyTags })}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : view === 'reports' ? (
          <div className={styles.body}>
            {!report ? (
              <p className={styles.muted}>A carregar…</p>
            ) : (
              <>
                <div className={styles.statGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{report.total}</span>
                    <span className={styles.statLabel}>Total de eventos</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{report.byStatus.publicado}</span>
                    <span className={styles.statLabel}>Publicados</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{report.byStatus.pendente}</span>
                    <span className={styles.statLabel}>Pendentes</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{report.byStatus.rascunho}</span>
                    <span className={styles.statLabel}>Rascunhos</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{report.byStatus.rejeitado}</span>
                    <span className={styles.statLabel}>Rejeitados</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statNum}>{report.privacy.private}</span>
                    <span className={styles.statLabel}>Privados</span>
                  </div>
                </div>

                {report.byCommunity.length > 0 && (
                  <div className={styles.reportSection}>
                    <h4 className={styles.reportHeading}>Por comunidade</h4>
                    <ul className={styles.barList}>
                      {report.byCommunity.map((c) => (
                        <li key={c.label} className={styles.barRow}>
                          <span className={styles.barLabel}>{c.label}</span>
                          <span className={styles.barValue}>{c.n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.byCategory.length > 0 && (
                  <div className={styles.reportSection}>
                    <h4 className={styles.reportHeading}>Por categoria</h4>
                    <ul className={styles.barList}>
                      {report.byCategory.map((c) => (
                        <li key={c.label} className={styles.barRow}>
                          <span className={styles.barLabel}>
                            {CATEGORY_META[c.label]?.label ?? c.label}
                          </span>
                          <span className={styles.barValue}>{c.n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.upcoming.length > 0 && (
                  <div className={styles.reportSection}>
                    <h4 className={styles.reportHeading}>Próximos eventos</h4>
                    <ul className={styles.list}>
                      {report.upcoming.map((e) => (
                        <li key={e.id} className={styles.item}>
                          <div className={styles.itemText}>
                            <strong className={styles.itemTitle}>{e.title}</strong>
                            <span className={styles.itemMeta}>
                              {formatDateNumericValue(e.startDatetime)}{' '}
                              · {CATEGORY_META[e.category]?.label ?? e.category} · {e.community}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.recent.length > 0 && (
                  <div className={styles.reportSection}>
                    <h4 className={styles.reportHeading}>Atividade recente</h4>
                    <ul className={styles.list}>
                      {report.recent.map((r, i) => (
                        <li key={i} className={styles.item}>
                          <div className={styles.itemText}>
                            <strong className={styles.itemTitle}>{r.eventTitle}</strong>
                            <span className={styles.itemMeta}>
                              {r.fromStatus ? `${r.fromStatus} → ` : ''}
                              {r.toStatus}
                              {r.actor ? ` · ${r.actor}` : ''} ·{' '}
                              {formatDateNumericValue(r.createdAt)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        ) : view === 'churches' ? (
          <div className={styles.body}>
            <form className={styles.userForm} onSubmit={handleSaveChurch}>
              <div className={styles.row}>
                <label className={styles.label}>
                  Nome *
                  <input
                    className={styles.input}
                    value={churchForm.name}
                    onChange={setChurchField('name')}
                    required
                  />
                </label>
                <label className={styles.label}>
                  ID inChurch
                  <input
                    className={styles.input}
                    type="number"
                    min="1"
                    placeholder="ex.: 33023"
                    value={churchForm.externalId}
                    onChange={setChurchField('externalId')}
                  />
                </label>
              </div>
              <div className={styles.row}>
                <label className={styles.label}>
                  Morada
                  <input
                    className={styles.input}
                    value={churchForm.address}
                    onChange={setChurchField('address')}
                  />
                </label>
                <label className={styles.label}>
                  Código postal
                  <input
                    className={styles.input}
                    placeholder="0000-000"
                    value={churchForm.postalCode}
                    onChange={setChurchField('postalCode')}
                  />
                </label>
              </div>
              <div className={styles.formActions}>
                {editingChurchId && (
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={cancelChurchEdit}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                )}
                <button type="submit" className={styles.primaryBtn} disabled={busy}>
                  <i
                    className={`ti ${editingChurchId ? 'ti-device-floppy' : 'ti-plus'}`}
                    aria-hidden="true"
                  />
                  <span>{editingChurchId ? 'Guardar igreja' : 'Criar igreja'}</span>
                </button>
              </div>
            </form>

            {dbChurches.length === 0 ? (
              <p className={styles.muted}>Ainda não há igrejas registadas.</p>
            ) : (
              <ul className={styles.list}>
                {dbChurches.map((c) => (
                  <li key={c.id} className={styles.item}>
                    <div className={styles.itemText}>
                      <strong className={styles.itemTitle}>{c.name}</strong>
                      <span className={styles.itemMeta}>
                        {c.externalId ? `inChurch #${c.externalId}` : 'sem ID inChurch'}
                        {c.address ? ` · ${c.address}` : ''}
                        {c.postalCode ? ` · ${c.postalCode}` : ''}
                      </span>
                    </div>
                    <div className={styles.actions}>
                      <button
                        className={styles.iconBtn}
                        onClick={() => openEditChurch(c)}
                        disabled={busy}
                        title="Editar"
                      >
                        <i className="ti ti-pencil" aria-hidden="true" />
                      </button>
                      <button
                        className={`${styles.iconBtn} ${styles.danger}`}
                        onClick={() => handleDeleteChurch(c)}
                        disabled={busy}
                        title="Eliminar"
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : view === 'categories' ? (
          <div className={styles.body}>
            <form className={styles.userForm} onSubmit={handleSaveCategory}>
              <div className={styles.row}>
                <label className={styles.label}>
                  Nome *
                  <input
                    className={styles.input}
                    value={categoryForm.label}
                    onChange={setCategoryField('label')}
                    required
                  />
                </label>
                <label className={styles.label}>
                  Identificador *
                  <input
                    className={styles.input}
                    value={categoryForm.slug}
                    onChange={setCategoryField('slug')}
                    placeholder="ex.: oracao"
                    disabled={!!editingCategoryId}
                    required={!editingCategoryId}
                  />
                </label>
              </div>
              <div className={styles.row}>
                <label className={styles.label}>
                  Cor
                  <input
                    className={styles.colorInput}
                    type="color"
                    value={categoryForm.color || '#F5A800'}
                    onChange={setCategoryField('color')}
                  />
                </label>
                <label className={styles.label}>
                  Ordem
                  <input
                    className={styles.input}
                    type="number"
                    value={categoryForm.sortOrder}
                    onChange={setCategoryField('sortOrder')}
                    placeholder="0"
                  />
                </label>
              </div>
              <div className={styles.formActions}>
                {editingCategoryId && (
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={cancelCategoryEdit}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                )}
                <button type="submit" className={styles.primaryBtn} disabled={busy}>
                  <i
                    className={`ti ${editingCategoryId ? 'ti-device-floppy' : 'ti-plus'}`}
                    aria-hidden="true"
                  />
                  <span>{editingCategoryId ? 'Guardar categoria' : 'Criar categoria'}</span>
                </button>
              </div>
            </form>

            {dbCategories.length === 0 ? (
              <p className={styles.muted}>Ainda não há categorias registadas.</p>
            ) : (
              <ul className={styles.list}>
                {dbCategories.map((c) => (
                  <li key={c.id} className={styles.item}>
                    <div className={styles.itemMain}>
                      <span
                        className={styles.colorDot}
                        style={{ background: c.color || 'hsl(var(--sc-muted-foreground))' }}
                        aria-hidden="true"
                      />
                      <div className={styles.itemText}>
                        <strong className={styles.itemTitle}>{c.label}</strong>
                        <span className={styles.itemMeta}>
                          {c.slug}
                          {c.color ? ` · ${c.color}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className={styles.actions}>
                      <button
                        className={styles.iconBtn}
                        onClick={() => openEditCategory(c)}
                        disabled={busy}
                        title="Editar"
                      >
                        <i className="ti ti-pencil" aria-hidden="true" />
                      </button>
                      <button
                        className={`${styles.iconBtn} ${styles.danger}`}
                        onClick={() => handleDeleteCategory(c)}
                        disabled={busy}
                        title="Eliminar"
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : view === 'privacyTags' ? (
          <div className={styles.body}>
            <p className={styles.muted}>
              As etiquetas agrupam os eventos privados. Cada utilizador vê todas as etiquetas
              ou apenas as que lhe forem atribuídas na gestão de utilizadores.
            </p>
            <form className={styles.userForm} onSubmit={handleSavePrivacyTag}>
              <div className={styles.row}>
                <label className={styles.label}>
                  Nome *
                  <input
                    className={styles.input}
                    value={privacyTagForm.name}
                    onChange={setPrivacyTagField('name')}
                    placeholder="ex.: Liderança"
                    required
                  />
                </label>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn} disabled={busy}>
                  <i className="ti ti-plus" aria-hidden="true" />
                  <span>Criar etiqueta</span>
                </button>
              </div>
            </form>

            {dbPrivacyTags.length === 0 ? (
              <p className={styles.muted}>Ainda não há etiquetas de privacidade registadas.</p>
            ) : (
              <ul className={styles.list}>
                {dbPrivacyTags.map((t) => (
                  <li key={t.id} className={styles.item}>
                    <div className={styles.itemMain}>
                      <i className="ti ti-shield-lock" aria-hidden="true" />
                      <div className={styles.itemText}>
                        <strong className={styles.itemTitle}>{t.name}</strong>
                      </div>
                    </div>
                    <div className={styles.actions}>
                      <button
                        className={`${styles.iconBtn} ${styles.danger}`}
                        onClick={() => handleDeletePrivacyTag(t)}
                        disabled={busy}
                        title="Eliminar"
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <form className={styles.body} onSubmit={handleSave}>
            <label className={styles.label}>
              Imagem do evento
              <div
                className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
                onClick={() => imageInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragActive(false)
                  handleImageFile(e.dataTransfer.files?.[0])
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    imageInputRef.current?.click()
                  }
                }}
              >
                {form.bannerUrl ? (
                  <div className={styles.imagePreviewWrap}>
                    <img src={form.bannerUrl} alt="" className={styles.imagePreview} />
                    <button
                      type="button"
                      className={styles.imageRemove}
                      onClick={(e) => {
                        e.stopPropagation()
                        setForm((f) => ({ ...f, bannerUrl: '' }))
                      }}
                      aria-label="Remover imagem"
                    >
                      <i className="ti ti-x" />
                    </button>
                  </div>
                ) : (
                  <div className={styles.dropzoneHint}>
                    <i className="ti ti-photo-up" />
                    <span>
                      {uploadingImage
                        ? 'A carregar…'
                        : 'Clique ou arraste uma imagem (PNG ou JPG, até 5MB, 16:9)'}
                    </span>
                  </div>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={(e) => {
                  handleImageFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>

            <label className={styles.label}>
              Nome do evento *
              <input
                className={styles.input}
                value={form.title}
                onChange={setField('title')}
                required
              />
            </label>

            <label className={styles.label}>
              Descrição
              <textarea
                className={styles.textarea}
                rows={3}
                value={form.description}
                onChange={setField('description')}
              />
            </label>

            <div className={styles.row}>
              <label className={styles.label}>
                Data de início *
                <input
                  type="date"
                  className={styles.input}
                  value={form.startDate}
                  onChange={setField('startDate')}
                  required
                />
              </label>
              <label className={styles.label}>
                Hora de início
                <input
                  type="time"
                  className={styles.input}
                  value={form.startTime}
                  onChange={setField('startTime')}
                  disabled={form.allDay}
                />
              </label>
            </div>

            <div className={styles.row}>
              <label className={styles.label}>
                Data de fim
                <input
                  type="date"
                  className={styles.input}
                  value={form.endDate}
                  onChange={setField('endDate')}
                />
              </label>
              <label className={styles.label}>
                Hora de fim
                <input
                  type="time"
                  className={styles.input}
                  value={form.endTime}
                  onChange={setField('endTime')}
                  disabled={form.allDay}
                />
              </label>
            </div>

            <div className={styles.row}>
              <label className={styles.label}>
                Igreja responsável
                <select
                  className={styles.input}
                  value={form.community}
                  onChange={setField('community')}
                >
                  {allowedChurches.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                Categoria
                <select
                  className={styles.input}
                  value={form.category}
                  onChange={setField('category')}
                >
                  {categoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className={styles.label}>
              Morada (igreja/comunidade)
              <input
                className={styles.input}
                value={form.location}
                onChange={setField('location')}
              />
            </label>

            <div className={styles.checks}>
              <label className={styles.check}>
                <input type="checkbox" checked={form.allDay} onChange={setField('allDay')} />
                Dia inteiro
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={form.isPrivate} onChange={setField('isPrivate')} />
                Privado (agenda restrita)
              </label>
            </div>

            {form.isPrivate && (
              <label className={styles.label}>
                Etiqueta de privacidade *
                <select
                  className={styles.input}
                  value={form.privacyTag}
                  onChange={setField('privacyTag')}
                  required
                >
                  <option value="">— Selecione —</option>
                  {dbPrivacyTags.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {dbPrivacyTags.length === 0 && (
                  <span className={styles.fieldHint}>
                    Ainda não há etiquetas. Crie-as em “Etiquetas de privacidade”.
                  </span>
                )}
              </label>
            )}

            {!editingId && (
              <fieldset className={styles.recurrence}>
                <legend>Repetição</legend>
                <div className={styles.row}>
                  <label className={styles.label}>
                    Tipo
                    <select
                      className={styles.input}
                      value={form.recurrenceType}
                      onChange={setField('recurrenceType')}
                    >
                      <option value="unique">Único</option>
                      <option value="recurrent">Recorrente</option>
                    </select>
                  </label>
                  {form.recurrenceType === 'recurrent' && (
                    <label className={styles.label}>
                      Frequência
                      <select
                        className={styles.input}
                        value={form.frequency}
                        onChange={setField('frequency')}
                      >
                        <option value="daily">Diária</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                      </select>
                    </label>
                  )}
                </div>

                {form.recurrenceType === 'recurrent' && (
                  <>
                    <div className={styles.row}>
                      <label className={styles.label}>
                        Repetir a cada
                        <input
                          type="number"
                          min="1"
                          max="99"
                          className={styles.input}
                          value={form.interval}
                          onChange={setField('interval')}
                        />
                      </label>
                      <label className={styles.label}>
                        Termina
                        <select
                          className={styles.input}
                          value={form.recEndType}
                          onChange={setField('recEndType')}
                        >
                          <option value="never">Nunca</option>
                          <option value="count">Após N ocorrências</option>
                          <option value="date">Numa data</option>
                        </select>
                      </label>
                    </div>

                    {form.recEndType === 'count' && (
                      <label className={styles.label}>
                        Número de ocorrências
                        <input
                          type="number"
                          min="1"
                          max="200"
                          className={styles.input}
                          value={form.recEndCount}
                          onChange={setField('recEndCount')}
                        />
                      </label>
                    )}
                    {form.recEndType === 'date' && (
                      <label className={styles.label}>
                        Data de fim da recorrência
                        <input
                          type="date"
                          className={styles.input}
                          value={form.recEndDate}
                          onChange={setField('recEndDate')}
                        />
                      </label>
                    )}
                  </>
                )}
              </fieldset>
            )}

            {editingId && form.seriesId && (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={applyToSeries}
                  onChange={(e) => setApplyToSeries(e.target.checked)}
                />
                Aplicar alterações a toda a série
              </label>
            )}

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => setView('events')}
                disabled={busy}
              >
                Cancelar
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={busy}>
                {busy ? 'A guardar…' : editingId ? 'Guardar' : 'Criar rascunho'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
