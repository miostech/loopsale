# LoopSale

Site do projeto LoopSale.

## Começar

### 1. MongoDB e conexão

O projeto usa **MongoDB**. Você precisa ter o MongoDB rodando e configurar a variável de conexão.

**No macOS (Homebrew):**

```bash
# Instalar MongoDB (se ainda não tiver)
brew tap mongodb/brew
brew install mongodb-community

# Iniciar o serviço
brew services start mongodb-community
```

**Arquivo `.env` na raiz do projeto:**

Crie um arquivo `.env` (copie do `.env.example`) e defina a URL do banco:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=loopsale
```

Ou use uma connection string completa:

```env
MONGODB_URI=mongodb://localhost:27017/loopsale
```

Se você já tinha dados no banco antigo `ussi`, defina `MONGODB_DB=ussi` no `.env` para não perder a base.

Não é necessário rodar migrations: as collections são criadas automaticamente quando o app insere o primeiro documento.

### 2. Instalar e rodar o app

```bash
yarn install
yarn dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador. Use **"Ver dashboard"** ou **"Ir direto para o dashboard (demo)"** na tela de login para entrar com o usuário demo.

**Nota:** Removemos PostgreSQL e Drizzle; o projeto usa apenas **MongoDB**. Se ainda tiver `drizzle` ou `postgres` no `package.json`, remova e rode `yarn install` para instalar o driver `mongodb`.

## Scripts

- `npm run dev` — servidor de desenvolvimento
- `npm run build` — build de produção
- `npm run start` — servidor de produção (após build)
- `npm run lint` — verificação de lint

## Stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
# loopsale
