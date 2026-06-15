# Deploy — Agenda CCLX (Hostinger VPS)

Guia de instalação em produção num **VPS Hostinger** (Ubuntu) com:

- **Nginx** — serve o front-end estático e faz proxy para o backend.
- **Node.js (PM2)** — backend Express (auth, papéis, gestão e proxy da API inRadar).
- **PostgreSQL** — base de dados (System of Record).

A arquitetura:

```
Internet ──HTTPS──> Nginx (443)
   ├── /            -> ficheiros estáticos (dist/)
   ├── /api/*       -> Node :4000  (proxy de leitura inRadar)
   ├── /auth/*      -> Node :4000  (OTP + sessão JWT)
   └── /data/*      -> Node :4000  (eventos / gestão)

Node/Express (PM2) ──> PostgreSQL (localhost:5432)
```

---

## 1. Pré-requisitos no VPS

```bash
# Node.js 20 LTS (o proxy usa fetch nativo, requer Node >= 18)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL + Nginx + utilitários
sudo apt-get install -y postgresql nginx git

# PM2 global
sudo npm install -g pm2
```

## 2. PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER cclx WITH PASSWORD 'troca-esta-password';
CREATE DATABASE cclx_agenda OWNER cclx;
SQL
```

A `DATABASE_URL` ficará:
`postgres://cclx:troca-esta-password@localhost:5432/cclx_agenda`

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
| `DATABASE_URL` | string do passo 2 |
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
- **PostgreSQL** escuta em `localhost`; não abrir 5432 ao exterior.
- **Logs do backend:** `pm2 logs cclx-agenda-api`.
- **Cookies de sessão** são `secure` em produção (só viajam por HTTPS) — por isso
  o TLS do passo 8 é obrigatório para o login funcionar.
