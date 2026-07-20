# Achafestas.pt — Identidade visual

## Logotipo

- [public/logo.svg](public/logo.svg) — versão completa (varal de bandeirinhas + pin + wordmark)
- [public/logo-mark.svg](public/logo-mark.svg) — símbolo isolado (favicon, marcadores do mapa, app icon)

Conceito: o pin de mapa (o mapa é a app) com uma romaria lá dentro — igreja com pessoas, varal de bandeirinhas e fogo de artifício. Pin com gradiente laranja→rosa (`#F97B16` → `#EC2456`), silhueta em azul noite `#1A2E4F`.

Nos marcadores do mapa e tamanhos pequenos usa-se a versão simplificada (pin liso com faísca) — o detalhe da igreja não sobrevive abaixo de ~48px.

## Paleta de cores

Uma só regra: **rosa-vermelho é a cor de ação, laranja é o acento, azul-noite é só texto/escuro.** Nunca usar azul como cor de botão/ação.

| Nome | Hex | Uso |
|---|---|---|
| Rosa-vermelho | `#EC2456` | **Cor primária** — todos os CTAs/botões, "festas" no wordmark, estado "a decorrer", clusters e pins ativos, links de destaque |
| Laranja | `#F97B16` | Secundária/acento — topo do gradiente do pin, estado "nos próximos 7 dias" |
| Azul-noite | `#1A2E4F` | Texto principal, "acha" no wordmark, silhueta do logo, ícones. **Nunca em botões de ação.** |
| Slate neutro | `#8B93A7` | Estado "mais tarde", texto desativado, bordas |
| Branco / cinza-claro | `#FFFFFF` / `#F5F6F8` | Fundos |

Gradiente da marca (hero, botão "Entrar", faixa da navbar): `#F97B16` → `#EC2456`.

## Regras rápidas

- Estados temporais no mapa: **a decorrer** = `#EC2456` (com pulso), **próximos 7 dias** = `#F97B16`, **mais tarde** = `#8B93A7` (recua)
- `cancelada` = slate com strikethrough; `provisoria` = contorno tracejado
- Raios de canto discretos: 4–8px (nada de `rounded-2xl`/pílulas grandes — dá ar de jogo)
- Tipografia: system-ui/Geist, pesos 400/700; wordmark em 800
