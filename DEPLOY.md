# Deploy — Agenda CCLX (Hostinger VPS)

Guia de instalação em produção num **VPS Hostinger** (Ubuntu) com:

- **Nginx** — serve o front-end estático e faz proxy para o backend.
- **Node.js (PM2)** — backend Express (auth, papéis, gestão e proxy da API inRadar).
- **Supabase** — Postgres gerido (System of Record) + Storage (imagens de eventos).

A arquitetura:

```
Internet ──HTTPS──> Nginx (443)
   ├── /            -> ficheiros estáticos (dist/)
   ├── /api/*       -> Node :4000  (proxy de leitura inRadar)
   ├── /auth/*      -> Node :4000  (OTP + sessão JWT)
   └── /data/*      -> Node :4000  (eventos / gestão)

Node/Express (PM2) ──TLS──> Supabase (Postgres pooler :5432 + Storage)
```

---

## 1. Pré-requisitos no VPS

```bash
# Node.js 20 LTS (o proxy usa fetch nativo, requer Node >= 18)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Nginx + utilitários (a base de dados é o Supabase, gerido — não é local)
sudo apt-get install -y nginx git

# PM2 global
sudo npm install -g pm2
```

## 2. Supabase (base de dados + Storage)

A base de dados é o **Supabase** (Postgres gerido) — não se instala Postgres no
VPS. No painel do projeto Supabase:

1. **Database → Connection string → "Session pooler"**: copia a string do
   Supavisor (porta `5432`, compatível com IPv4 e prepared statements). É esta
   que vai para `DATABASE_URL`:
   `postgresql://postgres.<ref>:<SENHA>@aws-0-<regiao>.pooler.supabase.com:5432/postgres`
2. **Storage → New bucket**: cria um bucket **público** para as imagens dos
   eventos (ex.: `event-images`) — o nome vai para `SUPABASE_STORAGE_BUCKET`.
3. **Project Settings → API**: copia o **Project URL** (`SUPABASE_URL`) e a
   chave **`service_role`** (`SUPABASE_SERVICE_ROLE_KEY`, usada só no backend).

## 3. Obter o código

```bash
sudo mkdir -p /var/www/cclx-agenda
sudo chown $USER:$USER /var/www/cclx-agenda
git clone <REPO_URL> /var/www/cclx-agenda
cd /var/www/cclx-agenda
```

## 4. Backend

```bash
cd /var/www/cclx-agenda/server
npm ci --omit=dev
cp .env.example .env
nano .env        # preencher segredos (ver abaixo)
```

Valores **obrigatórios** no `server/.env` em produção:

| Variável | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `https://agenda.cclx.pt` (domínio real) |
| `DATABASE_URL` | string do Supavisor (passo 2) |
| `DB_SSL` | `true` (TLS obrigatório no Supabase) |
| `SUPABASE_URL` | Project URL do Supabase (passo 2) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` (passo 2) — segredo, só backend |
| `SUPABASE_STORAGE_BUCKET` | nome do bucket público (ex.: `event-images`) |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `OTP_PEPPER` | outra string longa e aleatória |
| `SMTP_*` / `MAIL_FROM` | credenciais de email para envio dos códigos OTP |
| `INCHURCH_API_KEY` / `INCHURCH_API_SECRET` | credenciais da API inRadar |

Criar tabelas e o admin inicial:

```bash
npm run db:migrate
npm run db:seed
```

## 5. Front-end (build estático)

```bash
cd /var/www/cclx-agenda
npm ci
npm run build        # gera dist/
```

> O front-end chama `/api`, `/auth` e `/data` em caminhos relativos — o Nginx
> encaminha-os para o backend, por isso **não é preciso configurar URLs** no build.

## 6. Arrancar o backend com PM2

```bash
cd /var/www/cclx-agenda
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup          # seguir a instrução impressa para arranque no boot
```

## 7. Nginx

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/cclx-agenda
sudo nano /etc/nginx/sites-available/cclx-agenda   # ajustar server_name e root
sudo ln -s /etc/nginx/sites-available/cclx-agenda /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 8. HTTPS (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d agenda.cclx.pt
```

O Certbot adiciona o bloco `:443` e configura a renovação automática.

---

## Atualizações (novo deploy)

```bash
cd /var/www/cclx-agenda
git pull

# Backend
cd server && npm ci --omit=dev
npm run db:migrate          # se houver alterações ao schema
cd ..
pm2 reload cclx-agenda-api

# Front-end
npm ci && npm run build
```

O `dist/` é servido diretamente pelo Nginx; basta reconstruir.

---

## Notas

- **Firewall:** abrir apenas 80/443 (e 22 para SSH). A porta 4000 fica só em
  `localhost` — nunca exposta diretamente.
- **Base de dados:** o Supabase é gerido e acedido por TLS (saída para o pooler
  na porta `5432`); não há Postgres local nem porta de BD a expor.
- **Logs do backend:** `pm2 logs cclx-agenda-api`.
- **Cookies de sessão** são `secure` em produção (só viajam por HTTPS) — por isso
  o TLS do passo 8 é obrigatório para o login funcionar.
