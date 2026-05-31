# inChurch API — Referência Completa

> Documentação de referência da API pública inChurch (inRadar).
> Última verificação: 31 de maio de 2026.

---

## Informações Gerais

| Campo | Valor |
|---|---|
| **Base URL** | `https://inradar.com.br/public/v1` |
| **Autenticação** | HTTP Basic Auth (`apiKey:apiSecret` codificado em Base64) |
| **Header obrigatório** | `Authorization: Basic <base64(apiKey:apiSecret)>` |
| **Content-Type** | `application/json` |
| **Rate Limit** | 200 requests/min por cliente |
| **Formato de resposta** | JSON |

### Headers obrigatórios em cada request

```
Authorization: Basic <BASE64_ENCODED_CREDENTIALS>
Content-Type: application/json
X-API-Version: v1
```

### Paginação

Todas as respostas de listagem usam o formato:

```json
{
  "count": 314,
  "next": "https://inradar.com.br/public/v1/<resource>/?limit=10&offset=10",
  "previous": null,
  "results": [ ... ]
}
```

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `limit` | int | Número máximo de resultados por página (default: 10) |
| `offset` | int | Posição inicial na lista |

### Códigos de resposta

| Código | Significado |
|---|---|
| `200` | Sucesso |
| `201` | Criado com sucesso |
| `204` | Eliminado com sucesso (sem corpo) |
| `401` | Credenciais inválidas |
| `403` | Sem permissões para o recurso |
| `404` | Recurso não encontrado |
| `429` | Rate limit atingido (200 req/min) |

---

## Endpoints Confirmados

> **Nota:** A API usa nomes **singulares** nos paths (ex: `/event/`, `/group/`, `/cell/`), excepto `/people/` que é plural.

---

### People (Pessoas)

Path base: `/people/`

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/people/` | Lista todas as pessoas |
| `GET` | `/people/{personId}/` | Retorna uma pessoa pelo ID |
| `POST` | `/people/` | Cria uma nova pessoa |
| `PATCH` | `/people/{personId}/` | Atualiza parcialmente uma pessoa |
| `DELETE` | `/people/{personId}/` | Elimina uma pessoa |

#### Campos de resposta (Person)

```json
{
  "id": 5251585,
  "full_name": "Nome Completo",
  "gender": "female",
  "created_at": "2026-03-15T10:45:26.093423",
  "updated_at": "2026-03-15T10:56:38.281085",
  "church": { "id": 33023, "name": "Sede" },
  "status": "approved",
  "photo": "https://storage.googleapis.com/...",
  "is_pastor": false,
  "is_leader": false,
  "leadership_date": null,
  "accepted_jesus": true,
  "decision_context": "worship",
  "decision_date": null,
  "birthday": "1971-11-18",
  "cpf": null,
  "rg": null,
  "rg_state": "Rio de Janeiro",
  "church_profile": "frequent",
  "baptized": true,
  "baptism_date": null,
  "baptism_type": "immersion",
  "marital_status": "married",
  "marriage_date": "2009-10-31",
  "email": "email@exemplo.com",
  "phone": null,
  "mobile_phone": "+351911599191",
  "has_whatsapp": false,
  "membership_number": null,
  "has_special_needs": false,
  "special_needs_details": null,
  "id_document": "298848635",
  "document_country": null,
  "document_issuer": "Rep de Portugal",
  "profile_change_date": "2026-03-15",
  "joining_reason": null,
  "previous_church": "ICMAV",
  "roles": [],
  "education_level": "completed_masters",
  "occupation": "Gestora Clínica",
  "membership_type": "transfer",
  "visit_reason": null,
  "blood_type": null,
  "nationality": "Portugal",
  "birth_state": null,
  "birth_place": "Rio de Janeiro",
  "death_date": null,
  "membership_start_date": "2026-02-01",
  "first_visit_date": null,
  "is_active": true,
  "inactive_reason": null,
  "inactive_reason_details": null,
  "inactive_date": null,
  "location": {
    "country": "Portugal",
    "street_address": "Rua ...",
    "street_number": "13",
    "address_complement": "2º FTP",
    "international_state": "Lisboa",
    "international_city": "Sintra",
    "international_postal_code": "2745-324"
  }
}
```

#### POST /people/ — Body exemplo

```json
{
  "name": "Nome Completo",
  "email": "email@exemplo.com",
  "phone": "+5511999999999"
}
```

#### PATCH /people/{personId}/ — Body exemplo

```json
{
  "name": "Nome Atualizado"
}
```

---

### Groups (Grupos)

Path base: `/group/`

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/group/` | Lista todos os grupos |
| `GET` | `/group/{groupId}/` | Retorna um grupo pelo ID |

#### Campos de resposta (Group)

```json
{
  "id": 967670,
  "name": "Celebração"
}
```

> Os grupos retornam apenas `id` e `name`. Não há sub-recursos de membros expostos na API pública.

---

### Events (Eventos)

Path base: `/event/`

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/event/` | Lista todos os eventos |
| `GET` | `/event/{eventId}/` | Retorna um evento pelo ID |

#### Campos de resposta (Event)

```json
{
  "id": 1161108,
  "image": "https://storage.googleapis.com/...",
  "thumbnail": "https://storage.googleapis.com/...",
  "app_image": "https://storage.googleapis.com/...",
  "image_webp": "https://storage.googleapis.com/...",
  "show_on_calendar": true,
  "short_url_code": "D94J0",
  "description": "Descrição do evento",
  "end_datetime": "2026-04-04T13:00:00",
  "incomplete": false,
  "shareable": true,
  "subscription_deadline": "2026-04-04T13:00:00",
  "name": "Nome do Evento",
  "has_registrations": false,
  "start_datetime": "2026-04-04T09:30:00",
  "active": true,
  "enabled": true,
  "show_in_app": true,
  "show_on_site": false,
  "highlighted": false,
  "public": false,
  "available": true,
  "buyer_only_answers": false,
  "ticket_sorting": "id",
  "contact_email": null,
  "contact_phone": null,
  "contact_whatsapp": null,
  "facebook_url": null,
  "instagram_url": null,
  "twitter_url": null,
  "youtube_url": null,
  "event_url": null,
  "public_url": true,
  "public_subscription": true,
  "recurrence_model": false,
  "send_push_notifications": false,
  "push_sent": false,
  "legacy_v1": false,
  "hybrid": false,
  "allow_outsiders": false,
  "has_free_tickets": false,
  "has_paid_tickets": false,
  "has_available_tickets": false,
  "has_active_tickets": false,
  "has_external_subscription": false,
  "issued_tickets": 0,
  "available_tickets": null,
  "external_subscription_url": null,
  "hide_ticket_quantity": false,
  "event_fees": 0,
  "location": {
    "country": "Portugal",
    "state": "Sintra",
    "city": "MEM MARTINS",
    "zip_code": "2710-141",
    "address": "R THILO KRASSMAN BLOCO A ARMAZÉM 6",
    "address_number": "7",
    "address_complement": null,
    "neighborhood": "Abrunheira",
    "latitude": 38.7746253,
    "longitude": -9.3517764
  },
  "regional": { "id": 2368, "name": "Lisboa & Centro" },
  "responsible_church": null
}
```

---

### Cells (Células)

Path base: `/cell/`

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/cell/` | Lista todas as células |

#### Campos de resposta (Cell)

```json
{
  "id": 46619,
  "name": "Algueirão",
  "image": "https://storage.googleapis.com/...",
  "distance": null,
  "leaders": [
    { "name": "Nome", "phone": "+351...", "email": "email@..." }
  ],
  "supervisors": [
    { "name": "Nome", "phone": "+351...", "email": "email@..." }
  ],
  "auxiliaries": [],
  "location": {
    "country": "Portugal",
    "state": "Lisboa",
    "city": "Algueirão",
    "zip_code": "2725-112",
    "address": "Algueirão-Mem Martins",
    "address_number": "1",
    "address_complement": null,
    "neighborhood": "Mem Martins",
    "latitude": 38.79732389999999,
    "longitude": -9.3432155
  },
  "dates_text": "Sextas-feiras, a cada 2 semanas, de 20h às 22h",
  "weekdays": ["Sexta-feira"],
  "category": "Família",
  "frequency": 0,
  "address": "Algueirão-Mem Martins, 1 - Mem Martins, Algueirão, Lisboa, 2725-112"
}
```

---

### Donations (Doações)

Path base: `/donation/`

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/donation/` | Lista todas as doações |

> Endpoint confirmado (200 OK), mas sem dados no momento (count: 0).

#### POST /donation/ — Body exemplo (não confirmado)

```json
{
  "person_id": 1,
  "amount": 100.00,
  "date": "2026-05-28",
  "description": "Dízimo mensal"
}
```

---

## Endpoints NÃO Disponíveis na API Pública

Os seguintes paths foram testados e retornam **404 Not Found**:

| Path testado | Status |
|---|---|
| `/events/` | 404 (correto: `/event/`) |
| `/groups/` | 404 (correto: `/group/`) |
| `/cells/` | 404 (correto: `/cell/`) |
| `/donations/` | 404 (correto: `/donation/`) |
| `/person/` | 404 (correto: `/people/`) |
| `/financial/entries/` | 404 |
| `/financial/entry/` | 404 |
| `/financial/categories/` | 404 |
| `/financial/category/` | 404 |
| `/financial/cost-centers/` | 404 |
| `/financial/cost-center/` | 404 |
| `/financial/suppliers/` | 404 |
| `/financial/supplier/` | 404 |
| `/notifications/push/` | 404 |
| `/notification/push/` | 404 |
| `/security-group/` | 404 |
| `/security_group/` | 404 |
| `/role/` | 404 |
| `/permission/` | 404 |
| `/cell/{id}/members/` | 404 |
| `/cell/{id}/member/` | 404 |
| `/group/{id}/members/` | 404 |
| `/group/{id}/member/` | 404 |
| `/group/{id}/event/` | 404 |
| `/event/{id}/group/` | 404 |
| `/event/{id}/security-group/` | 404 |
| `/event/{id}/registrations/` | 404 |

---

## Resumo de Endpoints Activos

| Módulo | Path | Métodos | Status |
|---|---|---|---|
| People | `/people/` | GET, POST, PATCH, DELETE | ✅ Confirmado |
| Groups | `/group/` | GET | ✅ Confirmado |
| Events | `/event/` | GET | ✅ Confirmado |
| Cells | `/cell/` | GET | ✅ Confirmado |
| Donations | `/donation/` | GET | ✅ Confirmado (vazio) |
| Financial | `/financial/*` | — | ❌ Não disponível |
| Push | `/notifications/push/` | — | ❌ Não disponível |

---

## Exemplo de chamada (cURL)

```bash
curl --request GET \
  --url https://inradar.com.br/public/v1/people/?limit=10 \
  --header 'Authorization: Basic BASE64_ENCODED_CREDENTIALS' \
  --header 'Content-Type: application/json' \
  --header 'X-API-Version: v1'
```

## Exemplo de chamada (PowerShell)

```powershell
$pair = "$apiKey:$apiSecret"
$encoded = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
$headers = @{
    Authorization  = "Basic $encoded"
    'Content-Type' = 'application/json'
    'X-API-Version' = 'v1'
}

Invoke-RestMethod -Uri 'https://inradar.com.br/public/v1/people/?limit=10' `
    -Method GET -Headers $headers | ConvertTo-Json -Depth 10
```

---

## Notas

- As credenciais (`apiKey` / `apiSecret`) são geridas no ficheiro `environments/inchurch-api.postman_environment.json` e **não devem ser partilhadas**.
- A convenção de nomes da API é **singular** (`/event/`, `/group/`, `/cell/`, `/donation/`), excepto `/people/` que é **plural**.
- Módulos de Financial, Push Notifications e sub-recursos de membros de grupo/célula não estão expostos na API pública v1.
- Documentação oficial: https://docs.inchurch.com.br
