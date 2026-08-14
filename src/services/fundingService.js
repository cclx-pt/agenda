async function request(url, { method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.')
  return data
}

export async function listCampaigns() {
  return (await request('/data/funding')).campaigns
}

export async function createCampaign(payload) {
  return (await request('/data/funding', { method: 'POST', body: payload })).campaign
}

export async function updateCampaign(id, payload) {
  return (await request(`/data/funding/${id}`, { method: 'PUT', body: payload })).campaign
}

export async function getLedger(id) {
  return request(`/data/funding/${id}/ledger`)
}

export async function getCampaignPortal(id) {
  return (await request(`/data/funding/${id}/portal`)).campaign
}

export async function addDonation(campaignId, payload) {
  return (await request(`/data/funding/${campaignId}/donations`, { method: 'POST', body: payload })).donation
}

export async function setDonationReconciled(campaignId, donationId, reconciled) {
  return (await request(`/data/funding/${campaignId}/donations/${donationId}/reconcile`, {
    method: 'PATCH',
    body: { reconciled },
  })).donation
}

export async function addPledge(campaignId, payload) {
  return (await request(`/data/funding/${campaignId}/pledges`, { method: 'POST', body: payload })).pledge
}

export async function getPublicCampaign(slug) {
  return (await request(`/data/public/funding/${encodeURIComponent(slug)}`)).campaign
}