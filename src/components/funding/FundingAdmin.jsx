import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DateField from '../DateField'
import * as fundingService from '../../services/fundingService'

const CONFIGS = [
  ['C1', 'Donativo único'],
  ['C2', 'Mensal, 12 meses'],
  ['C3', 'Objetivo anual'],
  ['C4', 'Semanal'],
  ['C5', 'Mensal contínuo'],
]

const PHASE_PLANS = [
  ['', 'Manter a visibilidade escolhida durante toda a campanha'],
  ['V2 → V1 no lançamento', 'Começar reservada e publicar no lançamento'],
  ['V2 → V3 aos 25% → V1 no lançamento', 'Começar reservada, abrir aos doadores aos 25% e publicar no lançamento'],
]

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring'
const labelClass = 'flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground'
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50'
const ghostClass = 'inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50'

const today = () => new Date().toISOString().slice(0, 10)
const money = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
const displayDate = (value) => value ? value.split('-').reverse().join('-') : ''

const emptyCampaign = {
  slug: '', title: '', purpose: '', targetEur: '', deadline: '',
  configurations: ['C1'], visibilityMode: 'V1', phasePlan: '', status: 'draft',
}

const emptyDonation = {
  receiptNo: '', date: today(), amountEur: '', channel: 'transfer', configId: 'C1',
  donorName: '', donorContact: '', proofRef: '', notes: '',
}

function campaignPayload(form) {
  return { ...form, targetEur: Number(form.targetEur), phasePlan: form.phasePlan || null }
}

export default function FundingAdmin() {
  const [campaigns, setCampaigns] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [ledger, setLedger] = useState(null)
  const [campaignForm, setCampaignForm] = useState(emptyCampaign)
  const [donationForm, setDonationForm] = useState(emptyDonation)
  const [showSetup, setShowSetup] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showDonation, setShowDonation] = useState(false)
  const [busy, setBusy] = useState(true)

  const selected = campaigns.find((item) => item.id === selectedId) ?? null

  const loadCampaigns = async (preferredId) => {
    const items = await fundingService.listCampaigns()
    setCampaigns(items)
    const nextId = preferredId ?? selectedId ?? items[0]?.id ?? null
    setSelectedId(nextId)
    if (nextId) setLedger(await fundingService.getLedger(nextId))
    else setLedger(null)
  }

  useEffect(() => {
    fundingService.listCampaigns()
      .then(async (items) => {
        setCampaigns(items)
        const firstId = items[0]?.id ?? null
        setSelectedId(firstId)
        setLedger(firstId ? await fundingService.getLedger(firstId) : null)
      })
      .catch((error) => toast.error(error.message))
      .finally(() => setBusy(false))
  }, [])

  const chooseCampaign = async (id) => {
    setSelectedId(id)
    setShowSetup(false)
    setEditingId(null)
    setShowDonation(false)
    setBusy(true)
    try {
      setLedger(await fundingService.getLedger(id))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const submitCampaign = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const saved = editingId
        ? await fundingService.updateCampaign(editingId, campaignPayload(campaignForm))
        : await fundingService.createCampaign(campaignPayload(campaignForm))
      setCampaignForm(emptyCampaign)
      setShowSetup(false)
      setEditingId(null)
      await loadCampaigns(saved.id)
      toast.success(editingId ? 'Campanha atualizada.' : 'Campanha criada.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const openNewCampaign = () => {
    setCampaignForm(emptyCampaign)
    setEditingId(null)
    setShowSetup(true)
  }

  const editCampaign = () => {
    setCampaignForm({
      slug: selected.slug,
      title: selected.title,
      purpose: selected.purpose,
      targetEur: selected.targetEur,
      deadline: selected.deadline,
      configurations: selected.configurations,
      visibilityMode: selected.visibilityMode,
      phasePlan: selected.phasePlan ?? '',
      status: selected.status,
    })
    setEditingId(selected.id)
    setShowSetup(true)
    setShowDonation(false)
  }

  const cancelCampaignForm = () => {
    setCampaignForm(emptyCampaign)
    setEditingId(null)
    setShowSetup(false)
  }

  const deleteCampaign = async () => {
    if (!window.confirm(`Eliminar a campanha "${selected.title}"? Esta ação é irreversível.`)) return
    setBusy(true)
    try {
      await fundingService.deleteCampaign(selected.id)
      const items = await fundingService.listCampaigns()
      const nextId = items[0]?.id ?? null
      setCampaigns(items)
      setSelectedId(nextId)
      setLedger(nextId ? await fundingService.getLedger(nextId) : null)
      setShowDonation(false)
      toast.success('Campanha eliminada.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const activateCampaign = async () => {
    setBusy(true)
    try {
      await fundingService.updateCampaign(selected.id, { ...selected, status: selected.status === 'active' ? 'closed' : 'active' })
      await loadCampaigns(selected.id)
      toast.success(selected.status === 'active' ? 'Campanha encerrada.' : 'Campanha ativada.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const submitDonation = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await fundingService.addDonation(selected.id, {
        ...donationForm,
        amountEur: Number(donationForm.amountEur),
        donorName: donationForm.donorName || null,
        donorContact: donationForm.donorContact || null,
        notes: donationForm.notes || null,
      })
      setDonationForm({ ...emptyDonation, date: today(), configId: selected.configurations[0] })
      setShowDonation(false)
      await loadCampaigns(selected.id)
      toast.success('Donativo registado.')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const reconcile = async (donation) => {
    setBusy(true)
    try {
      await fundingService.setDonationReconciled(selected.id, donation.id, !donation.reconciled)
      await loadCampaigns(selected.id)
    } catch (error) {
      toast.error(error.message)
    } finally {
      setBusy(false)
    }
  }

  const copyPortalLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/funding/${encodeURIComponent(selected.slug)}`)
      toast.success('Link do portal copiado.')
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

  const previewCampaign = async () => {
    setBusy(true)
    try {
      await fundingService.getCampaignPortal(selected.id)
      window.location.assign(`/funding/${encodeURIComponent(selected.slug)}?preview=${encodeURIComponent(selected.id)}`)
    } catch (error) {
      toast.error(`Não foi possível pré-visualizar: ${error.message}`)
      setBusy(false)
    }
  }

  const toggleConfig = (id) => setCampaignForm((current) => ({
    ...current,
    configurations: current.configurations.includes(id)
      ? current.configurations.filter((item) => item !== id)
      : [...current.configurations, id],
  }))

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-primary">Financiamento</p>
          <h2 className="text-xl font-bold text-foreground">Campanhas e tesouraria</h2>
        </div>
        <button type="button" className={buttonClass} onClick={showSetup ? cancelCampaignForm : openNewCampaign}>
          <i className={`ti ${showSetup ? 'ti-x' : 'ti-plus'}`} aria-hidden="true" />
          {showSetup ? 'Cancelar' : 'Nova campanha'}
        </button>
      </header>

      {showSetup && (
        <form className="grid grid-cols-2 gap-3 border-y border-border py-4 max-[560px]:grid-cols-1" onSubmit={submitCampaign}>
          <label className={labelClass}>Nome<input required className={inputClass} value={campaignForm.title} onChange={(event) => setCampaignForm({ ...campaignForm, title: event.target.value })} /></label>
          <label className={labelClass}>Endereço do portal<input required disabled={!!editingId} pattern="[a-z0-9-]+" className={inputClass} placeholder="obras-da-igreja" value={campaignForm.slug} onChange={(event) => setCampaignForm({ ...campaignForm, slug: event.target.value.toLowerCase() })} /><span className="font-normal">/funding/{campaignForm.slug || 'nome-da-campanha'}{editingId ? ' · o endereço não pode ser alterado' : ''}</span></label>
          <label className={`${labelClass} col-span-2 max-[560px]:col-span-1`}>Propósito<textarea required className={inputClass} rows="2" value={campaignForm.purpose} onChange={(event) => setCampaignForm({ ...campaignForm, purpose: event.target.value })} /></label>
          <label className={labelClass}>Objetivo (€)<input required min="0.01" step="0.01" type="number" className={inputClass} value={campaignForm.targetEur} onChange={(event) => setCampaignForm({ ...campaignForm, targetEur: event.target.value })} /></label>
          <label className={labelClass}>Data limite<DateField required separator="-" className={inputClass} value={campaignForm.deadline} onChange={(value) => setCampaignForm({ ...campaignForm, deadline: value })} ariaLabel="Data limite" /></label>
          <fieldset className="col-span-2 max-[560px]:col-span-1">
            <legend className="mb-2 text-xs font-semibold text-muted-foreground">Modelos de contribuição</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">{CONFIGS.map(([id, label]) => <label key={id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={campaignForm.configurations.includes(id)} onChange={() => toggleConfig(id)} /> <strong>{id}</strong> {label}</label>)}</div>
          </fieldset>
          <label className={labelClass}>Visibilidade<select className={inputClass} value={campaignForm.visibilityMode} onChange={(event) => setCampaignForm({ ...campaignForm, visibilityMode: event.target.value })}><option value="V1">V1 · Totais públicos</option><option value="V2">V2 · Equipa e conselho</option><option value="V3">V3 · Acesso de doadores</option></select></label>
          <label className={labelClass}>Plano de publicação (opcional)<select className={inputClass} value={campaignForm.phasePlan} onChange={(event) => setCampaignForm({ ...campaignForm, phasePlan: event.target.value })}>{campaignForm.phasePlan && !PHASE_PLANS.some(([value]) => value === campaignForm.phasePlan) && <option value={campaignForm.phasePlan}>{campaignForm.phasePlan}</option>}{PHASE_PLANS.map(([value, label]) => <option key={value || 'none'} value={value}>{label}</option>)}</select><span className="font-normal">Regista a decisão da equipa. A mudança de visibilidade continua a ser feita manualmente em Editar.</span></label>
          <div className="col-span-2 flex justify-end max-[560px]:col-span-1"><button disabled={busy} className={buttonClass}>{editingId ? 'Guardar alterações' : 'Criar campanha'}</button></div>
        </form>
      )}

      {campaigns.length > 0 && (
        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Campanhas">
          {campaigns.map((campaign) => <button key={campaign.id} type="button" onClick={() => chooseCampaign(campaign.id)} className={`shrink-0 rounded-md border px-3 py-2 text-left text-sm ${campaign.id === selectedId ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent'}`}><strong className="block">{campaign.title}</strong><span className="text-xs">{campaign.status === 'active' ? 'Ativa' : campaign.status === 'closed' ? 'Encerrada' : 'Rascunho'} · {campaign.visibilityMode}</span></button>)}
        </nav>
      )}

      {!selected && !busy && <p className="py-10 text-center text-sm text-muted-foreground">Crie a primeira campanha para começar o registo financeiro.</p>}

      {selected && ledger && (
        <>
          <section className="border-b border-border pb-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{selected.title}</h3><p className="text-sm text-muted-foreground">{selected.purpose}</p></div><div className="flex flex-wrap gap-2"><button type="button" className={ghostClass} onClick={editCampaign}><i className="ti ti-pencil" aria-hidden="true" />Editar</button><button type="button" className={ghostClass} onClick={() => { setDonationForm({ ...emptyDonation, date: today(), configId: selected.configurations[0] }); setShowDonation((value) => !value); setShowSetup(false) }}><i className="ti ti-receipt" aria-hidden="true" />{showDonation ? 'Fechar donativo' : 'Registar donativo'}</button><button type="button" disabled={busy || selected.status === 'closed'} className={ghostClass} onClick={activateCampaign}><i className={`ti ${selected.status === 'active' ? 'ti-lock' : 'ti-rocket'}`} aria-hidden="true" />{selected.status === 'active' ? 'Encerrar' : 'Ativar'}</button><button type="button" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50" onClick={deleteCampaign}><i className="ti ti-trash" aria-hidden="true" />Eliminar</button></div></div>
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <div className="min-w-0 flex-1"><span className="block text-xs font-bold uppercase text-muted-foreground">Portal da campanha</span><code className="block truncate text-sm text-foreground">{window.location.origin}/funding/{selected.slug}</code><span className="text-xs text-muted-foreground">{selected.status === 'active' && selected.visibilityMode === 'V1' ? 'Publicado' : 'Ainda não publicado · disponível em pré-visualização para administradores'}</span></div>
              <button type="button" className={ghostClass} onClick={copyPortalLink}><i className="ti ti-copy" aria-hidden="true" />Copiar</button>
              <button type="button" className={ghostClass} onClick={previewCampaign} disabled={busy}><i className="ti ti-eye" aria-hidden="true" />Pré-visualizar</button>
              {selected.status === 'active' && selected.visibilityMode === 'V1' && <a className={ghostClass} href={`/funding/${encodeURIComponent(selected.slug)}`} target="_blank" rel="noreferrer"><i className="ti ti-external-link" aria-hidden="true" />Abrir portal</a>}
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${selected.percentage}%` }} /></div>
            <div className="grid grid-cols-3 gap-3 max-[560px]:grid-cols-1">
              {[['Recebido', money.format(selected.totalReceived)], ['Progresso', `${selected.percentage}%`], ['Por angariar', money.format(selected.remainingEur)]].map(([label, value]) => <div key={label}><span className="block text-xs text-muted-foreground">{label}</span><strong className="text-base text-foreground">{value}</strong></div>)}
            </div>
          </section>

          {showDonation && (
            <form className="flex max-w-2xl flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4" onSubmit={submitDonation}>
              <h3 className="font-bold">Registar donativo</h3>
              <div className="grid grid-cols-2 gap-3"><label className={labelClass}>Recibo<input required className={inputClass} value={donationForm.receiptNo} onChange={(event) => setDonationForm({ ...donationForm, receiptNo: event.target.value })} /></label><label className={labelClass}>Data<DateField required separator="-" className={inputClass} value={donationForm.date} onChange={(value) => setDonationForm({ ...donationForm, date: value })} ariaLabel="Data do donativo" /></label></div>
              <div className="grid grid-cols-2 gap-3"><label className={labelClass}>Valor (€)<input required type="number" min="0.01" step="0.01" className={inputClass} value={donationForm.amountEur} onChange={(event) => setDonationForm({ ...donationForm, amountEur: event.target.value })} /></label><label className={labelClass}>Canal<select className={inputClass} value={donationForm.channel} onChange={(event) => setDonationForm({ ...donationForm, channel: event.target.value })}><option value="transfer">Transferência</option><option value="mbway">MB Way</option><option value="cash">Numerário</option><option value="online">Online</option><option value="other">Outro</option></select></label></div>
              <div className="grid grid-cols-2 gap-3"><label className={labelClass}>Modelo<select className={inputClass} value={donationForm.configId} onChange={(event) => setDonationForm({ ...donationForm, configId: event.target.value })}>{selected.configurations.map((id) => <option key={id}>{id}</option>)}</select></label><label className={labelClass}>Doador (opcional)<input className={inputClass} value={donationForm.donorName} onChange={(event) => setDonationForm({ ...donationForm, donorName: event.target.value })} /></label></div>
              <label className={labelClass}>Referência da prova<input required className={inputClass} placeholder="Extrato, ficheiro ou envelope" value={donationForm.proofRef} onChange={(event) => setDonationForm({ ...donationForm, proofRef: event.target.value })} /></label>
              <div className="flex justify-end gap-2"><button type="button" className={ghostClass} onClick={() => setShowDonation(false)}>Cancelar</button><button disabled={busy} className={buttonClass}><i className="ti ti-receipt" aria-hidden="true" />Guardar no registo</button></div>
            </form>
          )}

          <section className="border-t border-border pt-5">
            <div className="mb-3 flex items-end justify-between"><div><h3 className="font-bold">Registo e reconciliação</h3><p className="text-xs text-muted-foreground">{ledger.donations.length} movimentos · {money.format(ledger.reconciledTotal)} reconciliados</p></div></div>
            {ledger.donations.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">Ainda não existem donativos.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="pb-2">Data / recibo</th><th className="pb-2">Origem</th><th className="pb-2">Valor</th><th className="pb-2">Prova</th><th className="pb-2 text-right">Estado</th></tr></thead><tbody>{ledger.donations.map((donation) => <tr key={donation.id} className="border-b border-border/60"><td className="py-3"><strong className="block">{displayDate(donation.date)}</strong><span className="text-xs text-muted-foreground">{donation.receiptNo}</span></td><td className="py-3">{donation.donorName === 'anonymous' ? 'Anónimo' : donation.donorName}<span className="block text-xs text-muted-foreground">{donation.channel} · {donation.configId}</span></td><td className="py-3 font-semibold">{money.format(donation.amountEur)}</td><td className="max-w-[170px] truncate py-3 text-xs text-muted-foreground" title={donation.proofRef}>{donation.proofRef}</td><td className="py-3 text-right"><button type="button" className={donation.reconciled ? 'text-emerald-600' : 'text-amber-600'} onClick={() => reconcile(donation)} disabled={busy}><i className={`ti ${donation.reconciled ? 'ti-circle-check-filled' : 'ti-clock'}`} aria-hidden="true" /> <span className="ml-1 text-xs font-semibold">{donation.reconciled ? 'Reconciliado' : 'Pendente'}</span></button></td></tr>)}</tbody></table></div>}
          </section>
        </>
      )}
    </div>
  )
}