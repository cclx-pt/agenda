import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { FIELD_TYPES, DEFAULT_RSVP_FIELDS, hasOptions, deriveKey, SYSTEM_KEYS } from './inviteFormFields'

// Editores de conteúdo por tipo de bloco (formulários "sem código"). Cada editor
// recebe { content, onChange } e chama onChange(novoConteudo) a cada alteração.

const inputCls = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground'
const labelCls = 'flex flex-col gap-1 text-sm font-medium text-foreground'
const smallBtn =
  'inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent'

// Editor genérico de uma lista de itens (adicionar/remover linhas).
function RowsEditor({ rows, onChange, emptyRow, render, addLabel }) {
  const list = Array.isArray(rows) ? rows : []
  const update = (i, patch) => onChange(list.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const removeRow = (i) => onChange(list.filter((_, idx) => idx !== i))
  const add = () => onChange([...list, { ...emptyRow }])
  return (
    <div className="flex flex-col gap-2">
      {list.map((row, i) => (
        <div key={i} className="rounded-lg border border-border bg-background p-2">
          <div className="flex items-start gap-2">
            <div className="flex-1">{render(row, (patch) => update(i, patch))}</div>
            <button type="button" onClick={() => removeRow(i)} className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label="Remover">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className={smallBtn}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  )
}

function BannerEditor({ content, onChange }) {
  const set = (k) => (e) => onChange({ ...content, [k]: e.target.value })
  return (
    <div className="flex flex-col gap-2">
      <label className={labelCls}>
        Descrição curta
        <input className={inputCls} value={content.shortDescription ?? ''} onChange={set('shortDescription')} />
      </label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className={labelCls}>
          Versículo
          <input className={inputCls} value={content.verse ?? ''} onChange={set('verse')} />
        </label>
        <label className={labelCls}>
          Referência
          <input className={inputCls} value={content.verseReference ?? ''} onChange={set('verseReference')} placeholder="Filipenses 4:13" />
        </label>
      </div>
      <label className={labelCls}>
        Texto do botão
        <input className={inputCls} value={content.ctaLabel ?? ''} onChange={set('ctaLabel')} placeholder="Inscrever-me" />
      </label>
      <p className="m-0 text-xs text-muted-foreground">A imagem, título, datas e local vêm das definições do convite.</p>
    </div>
  )
}

function InfoExtraEditor({ content, onChange }) {
  const set = (k) => (e) => onChange({ ...content, [k]: e.target.value })
  return (
    <div className="flex flex-col gap-2">
      <label className={labelCls}>
        Título
        <input className={inputCls} value={content.title ?? ''} onChange={set('title')} />
      </label>
      <label className={labelCls}>
        Texto
        <textarea className={inputCls} rows={3} value={content.body ?? ''} onChange={set('body')} />
      </label>
    </div>
  )
}

function NarrativeEditor({ content, onChange }) {
  const set = (k) => (e) => onChange({ ...content, [k]: e.target.value })
  return (
    <div className="flex flex-col gap-2">
      <label className={labelCls}>
        Narrativa
        <textarea className={inputCls} rows={4} value={content.narrative ?? ''} onChange={set('narrative')} />
      </label>
      <label className={labelCls}>
        Vídeo (YouTube/Vimeo, opcional)
        <input className={inputCls} value={content.videoUrl ?? ''} onChange={set('videoUrl')} placeholder="https://youtube.com/watch?v=…" />
      </label>
    </div>
  )
}

function SpeakersEditor({ content, onChange }) {
  const set = (k) => (e) => onChange({ ...content, [k]: e.target.value })
  return (
    <div className="flex flex-col gap-2">
      <label className={labelCls}>
        Título
        <input className={inputCls} value={content.title ?? ''} onChange={set('title')} />
      </label>
      <RowsEditor
        rows={content.speakers}
        onChange={(speakers) => onChange({ ...content, speakers })}
        emptyRow={{ name: '', role: '', bio: '', photoUrl: '' }}
        addLabel="Adicionar orador"
        render={(row, upd) => (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <input className={inputCls} placeholder="Nome" value={row.name ?? ''} onChange={(e) => upd({ name: e.target.value })} />
              <input className={inputCls} placeholder="Função (opcional)" value={row.role ?? ''} onChange={(e) => upd({ role: e.target.value })} />
            </div>
            <input className={inputCls} placeholder="Bio curta" value={row.bio ?? ''} onChange={(e) => upd({ bio: e.target.value })} />
            <input className={inputCls} placeholder="URL da foto" value={row.photoUrl ?? ''} onChange={(e) => upd({ photoUrl: e.target.value })} />
          </div>
        )}
      />
    </div>
  )
}

function AgendaEditor({ content, onChange }) {
  const set = (k) => (e) => onChange({ ...content, [k]: e.target.value })
  const days = Array.isArray(content.days) ? content.days : []
  const updateDay = (i, patch) => onChange({ ...content, days: days.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) })
  const removeDay = (i) => onChange({ ...content, days: days.filter((_, idx) => idx !== i) })
  const addDay = () => onChange({ ...content, days: [...days, { label: '', items: [] }] })
  return (
    <div className="flex flex-col gap-2">
      <label className={labelCls}>
        Título
        <input className={inputCls} value={content.title ?? ''} onChange={set('title')} />
      </label>
      {days.map((day, di) => (
        <div key={di} className="rounded-lg border border-border bg-muted/30 p-2">
          <div className="mb-1.5 flex items-center gap-2">
            <input className={inputCls} placeholder="Dia (ex.: Sábado)" value={day.label ?? ''} onChange={(e) => updateDay(di, { label: e.target.value })} />
            <button type="button" onClick={() => removeDay(di)} className="rounded p-1 text-destructive hover:bg-destructive/10" aria-label="Remover dia">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <RowsEditor
            rows={day.items}
            onChange={(items) => updateDay(di, { items })}
            emptyRow={{ time: '', title: '', owner: '' }}
            addLabel="Adicionar item"
            render={(row, upd) => (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                <input className={inputCls} placeholder="09:30" value={row.time ?? ''} onChange={(e) => upd({ time: e.target.value })} />
                <input className={inputCls} placeholder="Título" value={row.title ?? ''} onChange={(e) => upd({ title: e.target.value })} />
                <input className={inputCls} placeholder="Responsável (opcional)" value={row.owner ?? ''} onChange={(e) => upd({ owner: e.target.value })} />
              </div>
            )}
          />
        </div>
      ))}
      <button type="button" onClick={addDay} className={smallBtn}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Adicionar dia
      </button>
    </div>
  )
}

function WorkshopsEditor({ content, onChange }) {
  const set = (k) => (e) => onChange({ ...content, [k]: e.target.value })
  return (
    <div className="flex flex-col gap-2">
      <label className={labelCls}>
        Título
        <input className={inputCls} value={content.title ?? ''} onChange={set('title')} />
      </label>
      <RowsEditor
        rows={content.items}
        onChange={(items) => onChange({ ...content, items })}
        emptyRow={{ title: '', description: '', facilitator: '', day: '', time: '' }}
        addLabel="Adicionar workshop"
        render={(row, upd) => (
          <div className="flex flex-col gap-1.5">
            <input className={inputCls} placeholder="Título" value={row.title ?? ''} onChange={(e) => upd({ title: e.target.value })} />
            <input className={inputCls} placeholder="Descrição" value={row.description ?? ''} onChange={(e) => upd({ description: e.target.value })} />
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              <input className={inputCls} placeholder="Facilitador" value={row.facilitator ?? ''} onChange={(e) => upd({ facilitator: e.target.value })} />
              <input className={inputCls} placeholder="Dia" value={row.day ?? ''} onChange={(e) => upd({ day: e.target.value })} />
              <input className={inputCls} placeholder="Hora" value={row.time ?? ''} onChange={(e) => upd({ time: e.target.value })} />
            </div>
          </div>
        )}
      />
    </div>
  )
}

function RsvpEditor({ content, onChange }) {
  const set = (k) => (e) => onChange({ ...content, [k]: e.target.value })
  const fields = Array.isArray(content.fields) && content.fields.length ? content.fields : DEFAULT_RSVP_FIELDS
  const setFields = (next) => onChange({ ...content, fields: next })
  const updateField = (i, patch) => setFields(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  const removeField = (i) => setFields(fields.filter((_, idx) => idx !== i))
  const moveField = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= fields.length) return
    const next = [...fields]
    ;[next[i], next[j]] = [next[j], next[i]]
    setFields(next)
  }
  const addField = () =>
    setFields([
      ...fields,
      { key: deriveKey('Novo campo', fields.map((f) => f.key)), type: 'text', label: 'Novo campo', required: false },
    ])

  // Campos que podem controlar a visibilidade condicional de outros.
  const controllers = fields.filter((f) => ['checkbox', 'select', 'radio'].includes(f.type))

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className={labelCls}>
          Texto do botão
          <input className={inputCls} value={content.ctaLabel ?? ''} onChange={set('ctaLabel')} placeholder="Confirmar Presença" />
        </label>
        <label className={labelCls}>
          Texto informativo (opcional)
          <input className={inputCls} value={content.infoText ?? ''} onChange={set('infoText')} placeholder="Vagas limitadas. Inscrições até…" />
        </label>
      </div>

      <p className="m-0 text-xs font-semibold text-muted-foreground">Campos do formulário</p>
      <div className="flex flex-col gap-2">
        {fields.map((f, i) => {
          const isName = f.key === 'name'
          const isSystem = SYSTEM_KEYS.includes(f.key)
          const eligible = controllers.filter((c) => c.key !== f.key)
          const ctrl = f.visibleWhen?.field ? fields.find((x) => x.key === f.visibleWhen.field) : null
          return (
            <div key={f.key || i} className="rounded-lg border border-border bg-background p-2">
              <div className="flex items-start gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                    <select className={inputCls} value={f.type} onChange={(e) => updateField(i, { type: e.target.value })} disabled={isSystem} aria-label="Tipo de campo">
                      {FIELD_TYPES.map((t) => (
                        <option key={t.type} value={t.type}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputCls + ' sm:col-span-2'}
                      placeholder={f.type === 'section' ? 'Título da secção' : 'Rótulo do campo'}
                      value={f.label ?? ''}
                      onChange={(e) => updateField(i, { label: e.target.value })}
                    />
                  </div>

                  {hasOptions(f.type) ? (
                    <textarea
                      className={inputCls}
                      rows={3}
                      placeholder="Uma opção por linha"
                      value={(f.options || []).join('\n')}
                      onChange={(e) => updateField(i, { options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                    />
                  ) : null}

                  {f.type !== 'section' ? (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <label className="inline-flex items-center gap-1.5 text-sm text-foreground">
                        <input type="checkbox" checked={!!f.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                        Obrigatório
                      </label>
                      {eligible.length > 0 ? (
                        <div className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          Mostrar se
                          <select
                            className={inputCls + ' w-auto py-1'}
                            value={f.visibleWhen?.field || ''}
                            onChange={(e) => {
                              const field = e.target.value
                              if (!field) return updateField(i, { visibleWhen: undefined })
                              const c = fields.find((x) => x.key === field)
                              const equals = c?.type === 'checkbox' ? true : c?.options?.[0] ?? ''
                              return updateField(i, { visibleWhen: { field, equals } })
                            }}
                          >
                            <option value="">— sempre visível —</option>
                            {eligible.map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.label || c.key}
                              </option>
                            ))}
                          </select>
                          {f.visibleWhen?.field && ctrl?.type === 'checkbox' ? <span>= marcado</span> : null}
                          {f.visibleWhen?.field && ctrl && ctrl.type !== 'checkbox' ? (
                            <select
                              className={inputCls + ' w-auto py-1'}
                              value={String(f.visibleWhen.equals ?? '')}
                              onChange={(e) => updateField(i, { visibleWhen: { field: f.visibleWhen.field, equals: e.target.value } })}
                            >
                              {(ctrl.options || []).map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => moveField(i, -1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30" aria-label="Subir">
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30" aria-label="Descer">
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    disabled={isName}
                    className="rounded p-1 text-destructive hover:bg-destructive/10 disabled:opacity-30"
                    aria-label="Remover campo"
                    title={isName ? 'Campo obrigatório do sistema' : 'Remover'}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button type="button" onClick={addField} className={smallBtn}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Adicionar campo
      </button>
      <p className="m-0 text-xs text-muted-foreground">
        O prazo e a capacidade definem-se nas definições do convite. Os campos Nome, Email e Telemóvel ligam-se
        automaticamente ao registo do convidado; os restantes ficam guardados na inscrição.
      </p>
    </div>
  )
}

function LocationEditor({ content, onChange }) {
  const set = (k) => (e) => onChange({ ...content, [k]: e.target.value })
  return (
    <div className="flex flex-col gap-2">
      <label className={labelCls}>
        Morada
        <input className={inputCls} value={content.address ?? ''} onChange={set('address')} />
      </label>
      <label className={labelCls}>
        Link de direções (opcional)
        <input className={inputCls} value={content.directionsUrl ?? ''} onChange={set('directionsUrl')} placeholder="https://maps.google.com/…" />
      </label>
    </div>
  )
}

function FaqsEditor({ content, onChange }) {
  const set = (k) => (e) => onChange({ ...content, [k]: e.target.value })
  return (
    <div className="flex flex-col gap-2">
      <label className={labelCls}>
        Título
        <input className={inputCls} value={content.title ?? ''} onChange={set('title')} />
      </label>
      <RowsEditor
        rows={content.items}
        onChange={(items) => onChange({ ...content, items })}
        emptyRow={{ question: '', answer: '' }}
        addLabel="Adicionar pergunta"
        render={(row, upd) => (
          <div className="flex flex-col gap-1.5">
            <input className={inputCls} placeholder="Pergunta" value={row.question ?? ''} onChange={(e) => upd({ question: e.target.value })} />
            <textarea className={inputCls} rows={2} placeholder="Resposta" value={row.answer ?? ''} onChange={(e) => upd({ answer: e.target.value })} />
          </div>
        )}
      />
    </div>
  )
}

function FooterEditor({ content, onChange }) {
  const set = (k) => (e) => onChange({ ...content, [k]: e.target.value })
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className={labelCls}>
          Email de contacto
          <input className={inputCls} value={content.contactEmail ?? ''} onChange={set('contactEmail')} />
        </label>
        <label className={labelCls}>
          Telefone
          <input className={inputCls} value={content.contactPhone ?? ''} onChange={set('contactPhone')} />
        </label>
      </div>
      <label className={labelCls}>
        URL do logótipo
        <input className={inputCls} value={content.logoUrl ?? ''} onChange={set('logoUrl')} />
      </label>
      <RowsEditor
        rows={content.socialLinks}
        onChange={(socialLinks) => onChange({ ...content, socialLinks })}
        emptyRow={{ platform: '', url: '' }}
        addLabel="Adicionar rede social"
        render={(row, upd) => (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <input className={inputCls} placeholder="Plataforma" value={row.platform ?? ''} onChange={(e) => upd({ platform: e.target.value })} />
            <input className={inputCls} placeholder="URL" value={row.url ?? ''} onChange={(e) => upd({ url: e.target.value })} />
          </div>
        )}
      />
    </div>
  )
}

function EmptyEditor() {
  return <p className="m-0 text-xs text-muted-foreground">Este bloco é automático — não precisa de configuração.</p>
}

const EDITORS = {
  banner: BannerEditor,
  info_extra: InfoExtraEditor,
  convite_narrativo: NarrativeEditor,
  oradores: SpeakersEditor,
  agenda: AgendaEditor,
  workshops: WorkshopsEditor,
  rsvp: RsvpEditor,
  localizacao: LocationEditor,
  faqs: FaqsEditor,
  rodape: FooterEditor,
}

export function BlockEditor({ type, content, onChange }) {
  const Comp = EDITORS[type] || EmptyEditor
  return <Comp content={content || {}} onChange={onChange} />
}
