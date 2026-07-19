# Achafestas.pt

Mapa interativo de festas populares, romarias e feiras de Portugal — estilo fogos.pt, mas para festas.

## Stack

- **Next.js (App Router) + TypeScript** — SSR/SSG para SEO
- **Tailwind CSS + shadcn/ui**
- **MapLibre GL** — mapa fullscreen com clustering
- **Supabase** (Postgres + PostGIS, região UE) — dados, auth, storage
- **Vercel** — hosting

## Estrutura de dados

O núcleo é a separação **festa ≠ edição**:

- `festas` — entidade permanente (a Romaria d'Agonia existe todos os anos), com slug estável e localização PostGIS
- `edicoes` — a edição anual (datas, programa, estado: pendente/confirmada/provisória/cancelada)
- `concelhos` — tabela de referência dos concelhos

URLs permanentes `/festas/[concelho]/[slug]` que acumulam SEO ano após ano.

Migrações em [supabase/migrations](supabase/migrations).

## Desenvolvimento

```bash
cp .env.example .env.local   # preencher chaves do Supabase
npm install
npm run dev
```
