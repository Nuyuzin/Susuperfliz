# 🎬 SuperFlix — Stremio Addon

Addon para o [Stremio](https://www.stremio.com/) que busca streams de **filmes**, **séries** e **animes** diretamente via [SuperFlixAPI](https://superflixapi.cyou).

---

## ✅ Funcionalidades

- Suporte a **filmes** (via IMDB ID)
- Suporte a **séries e animes** (com temporada e episódio)
- Resolução automática de streams `.m3u8` (HLS) e `.mp4`
- Sem cadastro ou login necessário no Stremio

---

## ⚙️ Requisitos

- [Node.js](https://nodejs.org/) **18 ou superior**
- Uma chave gratuita da **API do TMDB** (necessária para converter IMDB ID → TMDB ID)

---

## 🔑 Obtendo a chave do TMDB (gratuita)

1. Acesse [https://www.themoviedb.org](https://www.themoviedb.org) e crie uma conta gratuita
2. Vá em **Configurações → API** (ou acesse [https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api))
3. Solicite uma **chave de API v3** (uso pessoal)
4. Copie a chave gerada

---

## 🚀 Como rodar localmente

```bash
# 1. Clone ou baixe o projeto
git clone https://github.com/seu-usuario/stremio-superflix.git
cd stremio-superflix

# 2. Instale as dependências
npm install

# 3. Configure o arquivo .env
cp .env.example .env
# Edite o .env e coloque sua TMDB_API_KEY

# 4. Inicie o servidor
npm start
```

O addon ficará disponível em:
- **Manifest:** `http://localhost:7000/manifest.json`
- **Instalar no Stremio:** `stremio://localhost:7000/manifest.json`

---

## 🌐 Como hospedar (para usar de qualquer lugar)

### Opção 1 — Railway (recomendado, gratuito)

1. Acesse [https://railway.app](https://railway.app) e faça login com GitHub
2. Clique em **New Project → Deploy from GitHub repo**
3. Selecione seu repositório
4. Em **Variables**, adicione:
   - `TMDB_API_KEY` = sua chave
   - `PORT` = `7000`
5. Aguarde o deploy. Railway vai gerar uma URL pública (ex: `https://superflix-addon.up.railway.app`)
6. Instale no Stremio: `stremio://superflix-addon.up.railway.app/manifest.json`

### Opção 2 — Render (gratuito)

1. Acesse [https://render.com](https://render.com) e conecte seu GitHub
2. Crie um **Web Service** apontando para o repositório
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment Variables:** `TMDB_API_KEY` e `PORT=7000`

### Opção 3 — VPS / Servidor próprio

```bash
# No servidor, clone o repo, configure o .env e rode com PM2:
npm install -g pm2
pm2 start index.js --name superflix-addon
pm2 save
pm2 startup
```

---

## 📲 Como instalar no Stremio

1. Abra o Stremio no computador ou no celular
2. Acesse **Addons** (ícone de peça de puzzle)
3. Clique em **+ Addon da Comunidade**
4. Cole a URL do manifest (ex: `https://sua-url.railway.app/manifest.json`)
5. Clique em **Instalar**

A partir de agora, quando você abrir um filme ou série, a opção **SuperFlix** vai aparecer na lista de streams disponíveis.

---

## 🏗️ Estrutura do Projeto

```
stremio-superflix/
├── index.js          # Ponto de entrada — manifest + handler de streams
├── lib/
│   ├── tmdb.js       # Converte IMDB ID → TMDB ID (via TMDB Find API)
│   └── superflix.js  # Busca e extrai URLs de vídeo do SuperFlixAPI
├── .env.example      # Modelo de variáveis de ambiente
├── .gitignore
├── package.json
└── README.md
```

---

## 🔄 Como funciona

```
Usuário seleciona conteúdo no Stremio
        ↓
Stremio envia requisição para o Addon com IMDB ID
        ↓
Addon converte IMDB ID → TMDB ID (via TMDB API)
        ↓
Addon acessa SuperFlixAPI com o TMDB ID
  └── /filme/{tmdb_id}               (filmes)
  └── /serie/{tmdb_id}/{s}/{e}       (séries/animes)
        ↓
Addon extrai URLs de vídeo (.m3u8 / .mp4) do player
        ↓
Addon retorna os streams para o Stremio
        ↓
Usuário clica e assiste ✅
```

---

## ⚠️ Avisos

- Este addon é para uso **pessoal e educacional**
- A disponibilidade dos streams depende do SuperFlixAPI
- Se um título não tiver stream, verifique se o TMDB ID corresponde ao conteúdo

---

## 🤝 Contribuições

Pull requests são bem-vindos! Abra uma issue para reportar bugs ou sugerir melhorias.
