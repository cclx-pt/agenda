import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, ExternalLink, Copy, Eye, Send, ArrowLeft, ArrowUp, ArrowDown,
  Users, Image as ImageIcon, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react'
import * as invitesService from '../../services/invitesService'
import { uploadEventImage } from '../../services/eventsService'
import DateField from '../DateField'
import TimeField from '../TimeField'
import { BlockEditor } from './InviteBlockEditors'
import { BLOCK_META, ADDABLE_TYPES, defaultContent } from './inviteBlockMeta'

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelCls = 'flex flex-col gap-1 text-sm font-medium text-foreground'
const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60'
const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-60'

const STATUS_BADGE = {
  rascunho: 'bg-muted text-muted-foreground',
  publicado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  fechado: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
}
const STATUS_LABEL = { rascunho: 'Rascunho', publicado: 'Publicado', fechado: 'Fechado' }

function toDateInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function toTimeInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function combineDateTime(date, time) {
  if (!date) return null
  return new Date(`${date}T${time || '00:00'}`).toISOString()
}

function publicUrl(slug) {
  return `${window.location.origin}/invite/${encodeURIComponent(slug)}`
}

// ── Editor de um convite ─────────────────────────────────────────
function InviteEditor({ invite, onBack, onSaved }) {
  const [settings, setSettings] = useState(() => ({
    title: invite.title ?? '',
    colorTheme: invite.colorTheme ?? '#1F3864',
    startDate: toDateInput(invite.startDatetime),
    startTime: toTimeInput(invite.startDatetime),
    endDate: toDateInput(invite.endDatetime),
    endTime: toTimeInput(invite.endDatetime),
    location: invite.location ?? '',
    bannerUrl: invite.bannerUrl ?? '',
    costType: invite.costType ?? 'gratuito',
    costAmount: invite.costAmount ?? '',
    paymentMethods: invite.paymentMethods ?? [],
    rsvpEnabled: invite.rsvpEnabled !== false,
    rsvpDeadlineDate: toDateInput(invite.rsvpDeadline),
    capacity: invite.capacity ?? '',
    metaDescription: invite.metaDescription ?? '',
  }))
  const [blocks, setBlocks] = useState(() => invite.blocks || [])
  const [openBlock, setOpenBlock] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [addType, setAddType] = useState(ADDABLE_TYPES[0]?.type ?? 'info_extra')
  const [guests, setGuests] = useState(null)

  const setField = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setSettings((s) => ({ ...s, [k]: v }))
  }

  const toggleMethod = (m) => {
    setSettings((s) => {
      const has = s.paymentMethods.includes(m)
      return { ...s, paymentMethods: has ? s.paymentMethods.filter((x) => x !== m) : [...s.paymentMethods, m] }
    })
  }

  const handleBanner = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadEventImage(file)
      setSettings((s) => ({ ...s, bannerUrl: url }))
      toast.success('Imagem carregada.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // Blocos: reordenar, visibilidade, remover, adicionar, editar conteúdo.
  const moveBlock = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    setBlocks(next)
  }
  const toggleVisible = (i) => setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, visible: !blk.visible } : blk)))
  const removeBlock = (i) => setBlocks((b) => b.filter((_, idx) => idx !== i))
  const setBlockContent = (i, content) => setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, content } : blk)))
  const addBlock = () => {
    setBlocks((b) => [...b, { id: null, type: addType, visible: true, content: defaultContent(addType) }])
    setOpenBlock(blocks.length)
  }

  const buildSettingsPayload = () => ({
    title: settings.title.trim(),
    colorTheme: settings.colorTheme || null,
    startDatetime: combineDateTime(settings.startDate, settings.startTime),
    endDatetime: settings.endDate ? combineDateTime(settings.endDate, settings.endTime) : null,
    location: settings.location.trim() || null,
    bannerUrl: settings.bannerUrl.trim() || null,
    metaImageUrl: settings.bannerUrl.trim() || null,
    metaDescription: settings.metaDescription.trim() || null,
    costType: settings.costType,
    costAmount: settings.costType === 'gratuito' ? null : Number(settings.costAmount) || null,
    paymentMethods: settings.paymentMethods.length ? settings.paymentMethods : null,
    rsvpEnabled: settings.rsvpEnabled,
    rsvpDeadline: settings.rsvpDeadlineDate ? combineDateTime(settings.rsvpDeadlineDate, '23:59') : null,
    capacity: settings.capacity ? Number(settings.capacity) : null,
  })

  const save = async () => {
    if (!settings.title.trim()) {
      toast.error('O título é obrigatório.')
      return
    }
    setBusy(true)
    try {
      await invitesService.updateInvite(invite.id, buildSettingsPayload())
      const updated = await invitesService.saveInviteBlocks(
        invite.id,
        blocks.map((b) => ({ type: b.type, visible: b.visible, content: b.content }))
      )
      toast.success('Convite guardado.')
      onSaved?.(updated)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (status) => {
    setBusy(true)
    try {
      const updated = await invitesService.setInviteStatus(invite.id, status)
      toast.success(status === 'publicado' ? 'Convite publicado.' : 'Estado atualizado.')
      onSaved?.(updated)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl(invite.slug))
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  const loadGuests = async () => {
    try {
      setGuests(await invitesService.listInviteGuests(invite.id))
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onBack} className={ghostBtn}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </button>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${STATUS_BADGE[invite.status]}`}>
          {STATUS_LABEL[invite.status]}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={copyLink} className={ghostBtn}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copiar link
          </button>
          <a href={publicUrl(invite.slug)} target="_blank" rel="noreferrer" className={ghostBtn}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Abrir
          </a>
          {invite.status !== 'publicado' ? (
            <button type="button" onClick={() => changeStatus('publicado')} disabled={busy} className={primaryBtn}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Publicar
            </button>
          ) : (
            <button type="button" onClick={() => changeStatus('fechado')} disabled={busy} className={ghostBtn}>
              Fechar inscrições
            </button>
          )}
        </div>
      </div>

      {/* Definições da página */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="m-0 mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Definições</h3>
        <div className="flex flex-col gap-3">
          <label className={labelCls}>
            Título *
            <input className={inputCls} value={settings.title} onChange={setField('title')} />
          </label>

          {/* Banner */}
          <div className={labelCls}>
            Imagem de banner
            <div className="flex items-center gap-3">
              {settings.bannerUrl ? (
                <img src={settings.bannerUrl} alt="Banner" className="h-16 w-28 rounded-lg object-cover" />
              ) : (
                <div className="flex h-16 w-28 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <ImageIcon className="h-5 w-5" aria-hidden="true" />
                </div>
              )}
              <label className={ghostBtn + ' cursor-pointer'}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImageIcon className="h-4 w-4" aria-hidden="true" />}
                {uploading ? 'A carregar…' : 'Carregar'}
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleBanner} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              Data de início
              <DateField className={inputCls} value={settings.startDate} onChange={(v) => setSettings((s) => ({ ...s, startDate: v }))} ariaLabel="Data de início" />
            </label>
            <label className={labelCls}>
              Hora de início
              <TimeField className={inputCls} value={settings.startTime} onChange={(v) => setSettings((s) => ({ ...s, startTime: v }))} ariaLabel="Hora de início" />
            </label>
            <label className={labelCls}>
              Data de fim
              <DateField className={inputCls} value={settings.endDate} onChange={(v) => setSettings((s) => ({ ...s, endDate: v }))} ariaLabel="Data de fim" />
            </label>
            <label className={labelCls}>
              Hora de fim
              <TimeField className={inputCls} value={settings.endTime} onChange={(v) => setSettings((s) => ({ ...s, endTime: v }))} ariaLabel="Hora de fim" />
            </label>
          </div>

          <label className={labelCls}>
            Local
            <input className={inputCls} value={settings.location} onChange={setField('location')} />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              Cor do tema
              <input type="color" className="h-10 w-full rounded-lg border border-input bg-background" value={settings.colorTheme} onChange={setField('colorTheme')} />
            </label>
            <label className={labelCls}>
              Custo
              <select className={inputCls} value={settings.costType} onChange={setField('costType')}>
                <option value="gratuito">Gratuito</option>
                <option value="pago">Pago</option>
                <option value="voluntario">Oferta voluntária</option>
              </select>
            </label>
          </div>

          {settings.costType !== 'gratuito' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelCls}>
                Valor (€)
                <input type="number" min="0" step="0.01" className={inputCls} value={settings.costAmount} onChange={setField('costAmount')} />
              </label>
              <div className={labelCls}>
                Métodos de pagamento
                <div className="flex flex-wrap gap-3 pt-1">
                  {['mbway', 'transferencia', 'referencia'].map((m) => (
                    <label key={m} className="inline-flex items-center gap-1.5 text-sm text-foreground">
                      <input type="checkbox" checked={settings.paymentMethods.includes(m)} onChange={() => toggleMethod(m)} />
                      {m === 'mbway' ? 'MB WAY' : m === 'transferencia' ? 'Transferência' : 'Referência'}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              Prazo de inscrição
              <DateField className={inputCls} value={settings.rsvpDeadlineDate} onChange={(v) => setSettings((s) => ({ ...s, rsvpDeadlineDate: v }))} ariaLabel="Prazo de inscrição" />
            </label>
            <label className={labelCls}>
              Capacidade (lugares)
              <input type="number" min="1" className={inputCls} value={settings.capacity} onChange={setField('capacity')} />
            </label>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" checked={settings.rsvpEnabled} onChange={setField('rsvpEnabled')} />
            Inscrições abertas
          </label>

          <label className={labelCls}>
            Descrição (partilha / Open Graph)
            <textarea className={inputCls} rows={2} value={settings.metaDescription} onChange={setField('metaDescription')} />
          </label>
        </div>
      </section>

      {/* Blocos de conteúdo */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">Blocos da página</h3>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {blocks.map((block, i) => (
            <li key={block.id || `new-${i}`} className="rounded-lg border border-border bg-background">
              <div className="flex items-center gap-2 p-2">
                <button
                  type="button"
                  onClick={() => setOpenBlock(openBlock === i ? null : i)}
                  className="inline-flex flex-1 items-center gap-2 text-left text-sm font-semibold text-foreground"
                >
                  {openBlock === i ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                  {BLOCK_META[block.type]?.label || block.type}
                  {!block.visible ? <span className="text-xs font-normal text-muted-foreground">(oculto)</span> : null}
                </button>
                <button type="button" onClick={() => toggleVisible(i)} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Alternar visibilidade" title="Mostrar/ocultar">
                  <Eye className={'h-4 w-4 ' + (block.visible ? '' : 'opacity-30')} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30" aria-label="Subir">
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30" aria-label="Descer">
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => removeBlock(i)} className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label="Remover bloco">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {openBlock === i ? (
                <div className="border-t border-border p-3">
                  <BlockEditor type={block.type} content={block.content} onChange={(content) => setBlockContent(i, content)} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className={inputCls + ' max-w-[240px]'} value={addType} onChange={(e) => setAddType(e.target.value)}>
            {ADDABLE_TYPES.map((t) => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
          <button type="button" onClick={addBlock} className={ghostBtn}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar bloco
          </button>
        </div>
      </section>

      {/* Inscrições */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-muted-foreground">Inscrições</h3>
          <button type="button" onClick={loadGuests} className={ghostBtn}>
            <Users className="h-4 w-4" aria-hidden="true" />
            {guests ? 'Atualizar' : 'Ver inscrições'}
          </button>
        </div>
        {guests ? (
          guests.length === 0 ? (
            <p className="m-0 mt-3 text-sm text-muted-foreground">Ainda não há inscrições.</p>
          ) : (
            <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
              {guests.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-2 border-b border-border/60 py-1.5 text-sm">
                  <span className="font-medium text-foreground">{g.name || '(sem nome)'}</span>
                  {g.email ? <span className="text-muted-foreground">{g.email}</span> : null}
                  <span className="text-muted-foreground">· {g.guestsCount} lugar(es)</span>
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{g.rsvpState}</span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      {/* Barra de ações fixa em baixo */}
      <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur">
        <button type="button" onClick={save} disabled={busy} className={primaryBtn}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Guardar convite
        </button>
      </div>
    </div>
  )
}

// ── Lista + criação ──────────────────────────────────────────────
export default function InvitesAdmin() {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setInvites(await invitesService.listInvites())
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const openEditor = async (id) => {
    setBusy(true)
    try {
      const invite = await invitesService.getInvite(id)
      setEditing(invite)
      setEditingId(id)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const createInvite = async () => {
    const title = window.prompt('Título do convite:')
    if (title == null || !title.trim()) return
    setBusy(true)
    try {
      const invite = await invitesService.createInvite({ title: title.trim() })
      setEditing(invite)
      setEditingId(invite.id)
      toast.success('Convite criado.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const deleteInvite = async (inv) => {
    if (!window.confirm(`Eliminar o convite "${inv.title}"? Esta ação é irreversível.`)) return
    setBusy(true)
    try {
      await invitesService.deleteInvite(inv.id)
      toast.success('Convite eliminado.')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async (slug) => {
    try {
      await navigator.clipboard.writeText(publicUrl(slug))
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  if (editingId && editing) {
    return (
      <InviteEditor
        invite={editing}
        onBack={() => {
          setEditingId(null)
          setEditing(null)
          load()
        }}
        onSaved={(updated) => setEditing((prev) => ({ ...updated, blocks: updated.blocks ?? prev.blocks }))}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="m-0 text-sm text-muted-foreground">
          Páginas de convite públicas e partilháveis, com blocos de conteúdo, inscrições e partilha.
        </p>
        <button type="button" onClick={createInvite} disabled={busy} className={primaryBtn}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo convite
        </button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">A carregar…</p>
      ) : invites.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há convites. Crie o primeiro.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {invites.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-muted/40 p-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm text-foreground">{inv.title}</strong>
                  <span className={`rounded-full px-2 py-[3px] text-[11px] font-bold uppercase ${STATUS_BADGE[inv.status]}`}>
                    {STATUS_LABEL[inv.status]}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">/invite/{inv.slug}</span>
              </div>
              <div className="ml-auto flex flex-shrink-0 gap-1.5">
                <button type="button" onClick={() => openEditor(inv.id)} disabled={busy} className={ghostBtn}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Editar
                </button>
                <button type="button" onClick={() => copyLink(inv.slug)} className={ghostBtn} aria-label="Copiar link">
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </button>
                <a href={publicUrl(inv.slug)} target="_blank" rel="noreferrer" className={ghostBtn} aria-label="Abrir">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
                <button type="button" onClick={() => deleteInvite(inv)} disabled={busy} className="inline-flex items-center rounded-lg border border-destructive/40 bg-transparent px-3 py-2 text-destructive transition-colors hover:bg-destructive/10" aria-label="Eliminar">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
