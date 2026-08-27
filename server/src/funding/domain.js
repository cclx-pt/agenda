export function campaignProgress(campaign) {
  const percentage = campaign.targetEur > 0
    ? Math.min(100, Math.round((campaign.totalReceived / campaign.targetEur) * 1000) / 10)
    : 0
  return {
    ...campaign,
    percentage,
    remainingEur: Math.max(0, campaign.targetEur - campaign.totalReceived),
  }
}

export function publicCampaignView(campaign) {
  const safe = campaignProgress(campaign)
  return {
    slug: safe.slug,
    title: safe.title,
    purpose: safe.purpose,
    targetEur: safe.targetEur,
    deadline: safe.deadline,
    configurations: safe.configurations,
    totalReceived: safe.totalReceived,
    donorCount: safe.donorCount,
    percentage: safe.percentage,
    remainingEur: safe.remainingEur,
  }
}