# Church Funding Campaign — Architecture & Implementation Guide

**Version:** 1.2 · **Owner:** [Campaign Manager] · **Approved by:** [Parish / Finance Council] · **Date:** [__ / __ / 2026]
**Change log:** v1.1 — added Section 3 "Funding Configurations" (C1–C5). v1.2 — added Section 3.4 "Follow-up visibility configuration" (V1 public / V2 private / V3 donors-only) with data-model and roadmap updates.

This document describes the operating architecture of the funding campaign and how to implement it, step by step. It is the reference companion to the campaign management deck (`church_funding_campaign.pptx`).

---

## 1. Purpose & Scope

Deliver a complete, auditable system to:

1. Define and approve a **funding objective**
2. Run a sustained **communication campaign**
3. Manage **donor follow-up** in two modes — **private** (individual, confidential) and **public** (aggregate, transparent)
4. **Receive donations and issue receipts** through all channels
5. Provide a **structure to maintain and validate** all funding records

Out of scope: spending/procurement of the funds raised (governed separately by the finance council).

---

## 2. Architecture Overview

```
                        ┌─────────────────────────────┐
                        │      FUNDING OBJECTIVE      │
                        │  target € · purpose · date  │
                        │  (approved by the council)  │
                        └──────────────┬──────────────┘
                                       │ drives
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
   ┌─────────────────────┐  ┌────────────────────┐  ┌─────────────────────┐
   │   COMMUNICATION     │  │   DONATION INTAKE  │  │   DONOR FOLLOW-UP   │
   │ pulpit · bulletin · │  │ cash · MB Way ·    │  │ PRIVATE: pledge     │
   │ e-mail · WhatsApp · │  │ transfer · online  │  │ register (restricted)│
   │ web/social · visits │  │                    │  │ PUBLIC: totals only │
   └──────────┬──────────┘  └─────────┬──────────┘  └──────────┬──────────┘
              │                       ▼                        │
              │        ┌──────────────────────────────┐        │
              │        │        RECORD SYSTEM         │        │
              └───────►│  Donation Register (SoT)     │◄───────┘
                       │  Receipt Book (sequential)   │
                       │  Pledge Register (private)   │
                       │  Archive (receipts + proofs) │
                       └──────────────┬───────────────┘
                                      ▼
                       ┌──────────────────────────────┐
                       │    VALIDATION & CONTROLS     │
                       │ 2-person rule · weekly bank  │
                       │ reconciliation · monthly     │
                       │ council review · audit       │
                       └──────────────┬───────────────┘
                                      ▼
                       ┌──────────────────────────────┐
                       │   REPORTING & GOVERNANCE     │
                       │ weekly KPIs · monthly status │
                       │ report · final transparency  │
                       │ report to the congregation   │
                       └──────────────────────────────┘
```

**Single source of truth (SoT):** the **Donation Register**. Every euro that enters through any channel must exist as one row in this register, linked to one receipt number and one proof document.

---

## 3. Funding Configurations (giving models)

The campaign must choose its **funding configuration(s)** before launch. A configuration defines how the objective is expressed, what a donor commits to, how progress is measured, and how receipts are issued. One configuration can run alone, or several can be combined under the same objective.

### 3.1 Configuration catalogue

| ID | Configuration | Objective definition | Donor commitment | Best suited for | Receipt model |
|---|---|---|---|---|---|
| **C1** | **One-shot** | Single target **€ T by date D** | One gift, any time before D | Capital projects with a deadline (roof, hall, organ) | Receipt per gift |
| **C2** | **Monthly with annual objective** | Annual target **€ T = 12 × Σ monthly pledges** | Fixed **€ m / month** for 12 months | Sustained projects needing predictable cash flow | Receipt per payment **+ consolidated annual statement** |
| **C3** | **Annual objective** | **€ T within the year**, timing free | Annual pledge, paid in 1–n installments at the donor's choice | General fund / tithing-style giving | Consolidated annual receipt (per-gift on request) |
| **C4** | **Weekly** | Weekly collection target **€ w** (52 × w ≈ annual need) | Weekly offering (envelope or standing order) | Broad congregation participation, regular offerings | Envelope-number tracking; annual statement for identified donors |
| **C5** | **Monthly (rolling)** | Monthly target **€ m**, no fixed end date | Standing order **€ m / month**, open-ended | Operating costs and ongoing ministries | Auto-logged monthly; annual statement |

### 3.2 What changes per configuration

The intake process (Receive → Record → Issue receipt → Archive → Reconcile) is **identical for all configurations**. What changes is the planning and follow-up layer:

| Dimension | C1 One-shot | C2 Monthly + annual obj. | C3 Annual | C4 Weekly | C5 Monthly rolling |
|---|---|---|---|---|---|
| Progress KPI | % of target (cumulative curve) | **Collection rate** = received ÷ expected-to-date | Received vs. straight-line pro-rata | Weekly average vs. € w | # active standing orders + € m attainment |
| "Expected-to-date" | Milestone curve (25/50/75/100%) | months elapsed × Σ monthly pledges | (days elapsed ÷ 365) × € T | weeks elapsed × € w | € m per month |
| Follow-up trigger (private mode) | Pledge open past promised date | **Missed month** (> 15 days late) | Mid-year reminder + Q4 push | Lapsed envelope (> 3 weeks) | Cancelled / failed standing order |
| Main risk | Everything arrives at the deadline | Pledge attrition over 12 months | December bunching → cash-flow gap | Attendance-dependent | Silent churn |
| Counting-team load | Peaks at campaign events | Low (mostly bank/MB Way) | Low | **Highest — every week** | Lowest (automated) |
| Public reporting | Thermometer vs. € T | Monthly bar vs. plan | Quarterly progress vs. pro-rata | Weekly total at service | Monthly "sustainers" count |

### 3.3 Choosing and combining configurations

Decision guide:

- **Fixed project with a deadline** → **C1**, offering **C2 as a payment path** ("give once, or pledge it in 12 monthly parts") — one objective, two ways to fulfil it. *Recommended default for a capital campaign.*
- **Predictable yearly budget** → **C2** (strongest predictability) or **C3** (more donor freedom, weaker cash-flow control).
- **Ongoing operations / ministries** → **C5**, complemented by **C4** offerings.
- Combinations are fine, but **each donation row records which configuration it belongs to**, and the public progress report always reconciles to **one headline objective** — never publish overlapping totals.

Approval rule: the chosen configuration(s), the objective formula and the follow-up triggers are approved by the council together with the target (Section 4.1), and are not changed mid-campaign without a minuted council decision.

### 3.4 Follow-up visibility configuration (V1–V3)

Besides the giving model (C1–C5), the campaign must choose **who can see follow-up information**. This is a second, independent configuration axis — any C can combine with any V.

| ID | Visibility mode | Who sees campaign progress | Who sees donor-level data | Typical use |
|---|---|---|---|---|
| **V1** | **Public** | Everyone — congregation and beyond (services, bulletin, website) | Nobody except treasurer + deputy (donor data always confidential) | Default for capital campaigns — transparency builds momentum |
| **V2** | **Private** | Campaign team + council only; no public totals during the campaign | Treasurer + deputy | Discreet campaigns (e.g. sensitive purpose, early "quiet phase" before public launch) |
| **V3** | **By access — donors only** | Only registered donors, via restricted channel (closed WhatsApp/e-mail group, password page, donor meetings) | Treasurer + deputy; each donor sees **only their own** giving statement | Pledge-based campaigns (C2/C3) where progress is shared with committed participants first |

**Rules that apply in every mode:**

- Donor names and individual amounts are **never** published — the mode changes who sees *aggregate progress*, never who sees *personal data*.
- V3 access list = donors who gave or pledged **and** consented to be contacted; access is revoked on request; the list is owned by the treasurer.
- In V3, each donor can see the campaign totals plus **their own** statement — never another donor's.
- Modes can be phased and must be pre-agreed: e.g. **V2 quiet phase → V3 donor preview at 25% → V1 public from launch Sunday**. Any switch is a minuted council decision, announced before it happens.
- Whatever the mode, the council always receives the monthly summary, and the **final transparency report** at campaign close is published to the whole congregation (V1-level) unless the council minutes an explicit exception.

**Impact per area:**

| Area | V1 Public | V2 Private | V3 Donors-only |
|---|---|---|---|
| Pulpit / bulletin / thermometer | Yes, weekly | No | No (or "campaign ongoing" only) |
| Website / social media | Progress bar + total | Nothing | Login/closed group only |
| Milestone celebrations | Whole congregation | Team + council | Donor events / restricted messages |
| Donor statements & receipts | Individual, private (as always) | Individual, private | Individual, self-service or on request |
| KPI sheet distribution | Publishable version weekly | Council only | Restricted list + council |

### 3.5 Impact on the data model (see Section 5)

- Pledge Register — `schedule` becomes an enum: `one_shot | monthly_12 | annual | weekly | monthly_rolling`
- Donation Register — add `config_id (C1–C5)` so every gift maps to its configuration
- Campaign settings (one row per campaign) — `visibility_mode (V1 | V2 | V3)` + `phase_plan` (e.g. "V2 → V3@25% → V1@launch")
- Pledge Register — add `access_granted (Y/N)` and `access_revoked_date` for the V3 donors-only list
- KPI Sheet — add `expected_to_date` and `collection_rate_%` (computed per the table in 3.2); in V2/V3, mark the sheet's distribution list explicitly
- Receipts — every gift is always logged individually; consolidated annual statements (C2–C5) are **generated from** the register, never maintained separately

---

## 4. Components

### 4.1 Funding Objective

| Element | Definition |
|---|---|
| Target | One amount, e.g. € 50,000 — approved before launch |
| Purpose | One clearly stated project (e.g. roof renovation) |
| Deadline | Fixed end date + milestones at 25% / 50% / 75% / 100% |
| Breakdown | Visible blocks: works € __ · equipment € __ · reserve € __ |
| Approval | Recorded in council minutes before any public communication |

### 4.2 Communication Campaign

- **Core message (fixed):** "Together we will [purpose] — our goal is € [target] by [date]. Every gift counts, and every euro is accounted for."
- **Channels:** Sunday announcements · newsletter/e-mail · WhatsApp/SMS group leaders · website & social media · printed bulletin & progress thermometer · personal visits (larger pledges, always in pairs).
- **Phases:** Launch (wk 1–2) → Momentum (wk 3–8) → Final push (wk 9–12) → Gratitude & transparency report (wk 13+).
- **Rule:** every communication states the purpose, the current progress, and one clear way to give.

### 4.3 Donor Follow-up — Two Modes

> How widely the **public mode** below is actually broadcast depends on the campaign's visibility configuration (Section 3.4): **V1** = whole congregation, **V2** = team + council only, **V3** = registered donors only. Private mode (donor-level data) is confidential in every configuration.

| | **Private mode** | **Public mode** |
|---|---|---|
| Content | Individual donors, pledges, amounts, schedules | Aggregate totals, % of target, milestones |
| Access | Treasurer + one deputy only | Whole congregation |
| Actions | Thank-you within 7 days · discreet reminders on overdue pledges · year-end statement + receipt | Weekly total at services & thermometer · milestone celebrations · monthly council summary · final transparency report |
| Golden rule | **Publish totals, protect names.** Donor data is never shared or published. | |

### 4.4 Donation Intake & Receipts (per-donation process)

```
RECEIVE → RECORD → ISSUE RECEIPT → ARCHIVE → RECONCILE
```

1. **Receive** — via any channel (cash counted by 2 people same day; MB Way/card exported weekly; bank transfer to a dedicated campaign IBAN with reference "Campaign"; online page sends automatic confirmation).
2. **Record** — one row in the Donation Register: date, amount, channel, donor (if known), receipt no.
3. **Issue receipt** — sequential number, no gaps, no reuse; official *recibo de donativo* for tax purposes on request (confirm eligibility rules with the diocese / accountant).
4. **Archive** — receipt copy filed together with its proof (count sheet, deposit slip, or bank statement line).
5. **Reconcile** — register vs. bank statement matched weekly by a second person.

### 4.5 Record-Keeping Structure (roles)

| Role | Responsibility | Function |
|---|---|---|
| Treasurer (owner) | Donation register, receipt book, monthly summary | Owns |
| Counting team (2+, rotating) | Counts cash in pairs, signs count sheet, deposits within 48h | Executes |
| Secretary / registrar | Files receipts, count sheets, bank proofs; numbering log | Maintains |
| Finance council / auditor | Monthly reconciliation review, quarterly spot-checks, reports to leadership | Validates |

**Segregation of duties:** the person who receives money never validates it alone; the person who records never audits. No single person touches a donation end-to-end.

### 4.6 Validation & Controls

| Frequency | Controls |
|---|---|
| Per donation | Two-person rule for cash · sequential receipt number · receipt + proof archived together |
| Weekly | Register vs. bank reconciliation · digital channels exported and matched · progress total validated before public announcement |
| Monthly | Treasurer summary reviewed by council · pledge register vs. receipts cross-checked · numbering log inspected for gaps |
| Quarterly / close | Independent spot-check of random receipts · full campaign audit · transparency report published |

**If a check fails:** stop, document, escalate to the finance council. Never adjust records to "make them match".

---

## 5. Data Model (registers)

Implement as protected spreadsheet tabs (or a simple database later). One tab per register.

**Donation Register (SoT)** — one row per donation
`receipt_no · date · amount_eur · channel (cash/mbway/transfer/online) · config_id (C1–C5) · donor_id (or "anonymous") · pledge_ref (optional) · proof_ref · recorded_by · reconciled (Y/N) · reconciled_by/date`

**Pledge Register (PRIVATE — restricted access)**
`pledge_id · donor_id · donor_name · contact · pledged_amount · schedule (one_shot / monthly_12 / annual / weekly / monthly_rolling) · received_to_date · status (open/partial/fulfilled/overdue) · last_follow_up · consent_recorded (Y/N)`

**Receipt Numbering Log**
`receipt_no · issued_date · issued_by · type (simple/tax) · void_reason (if cancelled — never deleted)`

**KPI Sheet (PUBLIC-safe)**
`week · total_received · %_of_target · expected_to_date (per configuration, see 3.2) · collection_rate_% (received ÷ expected) · nº_donors · pledge_fulfilment_% · receipts_issued (= donations recorded — must match)`

**Archive index**
`proof_ref · type (count sheet/deposit slip/statement) · location (folder/box) · linked receipt_nos`

Rules: no deletions (void + reason instead) · dates in ISO format · one campaign = one IBAN = one register.

---

## 6. Implementation Roadmap

**Phase 0 — Approve (week −3)**
- [ ] Council approves target, purpose, deadline, breakdown (minuted)
- [ ] Council selects the funding configuration(s) — C1–C5, Section 3 — and the follow-up triggers that go with them
- [ ] Council selects the follow-up visibility mode — V1 public / V2 private / V3 donors-only, Section 3.4 — including any phased plan (e.g. V2 → V3 → V1)
- [ ] Appoint: treasurer, deputy, counting team (2+), registrar, council reviewer
- [ ] Confirm receipt/tax rules (*recibos de donativo*) with diocese / accountant

**Phase 1 — Set up (weeks −2 to −1)**
- [ ] Open/dedicate campaign IBAN; set up MB Way / online giving page
- [ ] Create the 5 registers (Section 4) with access restrictions on the Pledge Register
- [ ] Print/prepare sequential receipt book; start numbering log at 0001
- [ ] Prepare materials: campaign page, bulletin insert, posters, thermometer, pledge cards
- [ ] Dry-run the intake process once with a test donation

**Phase 2 — Launch (weeks 1–2)**
- [ ] Announce at all services; distribute pledge cards; publish campaign page
- [ ] Start the weekly rhythm (below)

**Phase 3 — Run (weeks 3–12)**
- Weekly rhythm: **Mon** reconcile + update KPI sheet · **Wed** 30-min team check-in (progress, risks, follow-ups) · **Fri** publish public update, prepare Sunday announcement
- Monthly: status report to council — progress vs. last month, risks with owners, decisions needed, loop closure on every open item
- Milestones: public celebration at 25% / 50% / 75%

**Phase 4 — Close (week 13+)**
- [ ] Final reconciliation and independent audit
- [ ] Individual thank-you letters + year-end receipts/statements
- [ ] Publish transparency report: total received, costs, use of funds
- [ ] Archive everything; retain per legal/diocesan requirements

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Cash mishandling / loss of trust | High | Two-person rule, same-day counting, 48h deposit, rotation |
| Receipt gaps / duplicates | High | Sequential numbering + monthly gap inspection; void, never delete |
| Donor data leak | High | Pledge register restricted to 2 people; publish totals only; consent recorded |
| Campaign fatigue | Medium | Phased communication, milestone celebrations, testimonies |
| Target missed at deadline | Medium | Weekly KPI tracking; final-push phase; council decision on extension pre-agreed |
| Key-person dependency | Medium | Deputy treasurer trained; documented process (this file) |

---

## 8. Definition of Done

The system is correctly implemented when, for **any** donation picked at random, you can show within 5 minutes: its register row → its receipt number → its archived proof → the bank line it reconciles to → the week it appeared in the public total.
