// MOCK TEMPORÁRIO de pré-visualização (imagens do Lorem Picsum), enquanto o
// Supabase não tem cartazes/fotos/programa reais. Remover quando houver dados.

import type { ProgramaDia } from "@/lib/festa-detalhe";

// Cartaz por festa — usado na lista, painel, pins e páginas de evento.
export const MOCK_CARTAZES: Record<string, string> = {
  "romaria-da-agonia": "https://picsum.photos/seed/af-agonia/600/800",
  "feiras-novas": "https://picsum.photos/seed/af-feiras/600/800",
  "sao-bartolomeu-do-mar": "https://picsum.photos/seed/af-bartolomeu/600/800",
  "festas-senhora-boa-viagem": "https://picsum.photos/seed/af-boaviagem/600/800",
  "festas-divino-salvador": "https://picsum.photos/seed/af-salvador/600/800",
};

// Fotos + programa completos (só a Feiras Novas, para demonstrar a página cheia).
export const MOCK_DETALHE: Record<
  string,
  { fotos: string[]; programa: ProgramaDia[] }
> = {
  "feiras-novas": {
    fotos: [
      "https://picsum.photos/seed/af1/800/600",
      "https://picsum.photos/seed/af2/800/600",
      "https://picsum.photos/seed/af3/800/600",
      "https://picsum.photos/seed/af4/800/600",
      "https://picsum.photos/seed/af5/800/600",
      "https://picsum.photos/seed/af6/800/600",
    ],
    programa: [
      {
        dia: "Sexta, 4 de setembro",
        eventos: [
          { hora: "18:00", titulo: "Abertura oficial e pregão das Feiras Novas" },
          { hora: "21:30", titulo: "Concerto de abertura no palco principal" },
          { hora: "23:30", titulo: "Noite de DJ na Praça da República" },
        ],
      },
      {
        dia: "Sábado, 5 de setembro",
        eventos: [
          { hora: "10:00", titulo: "Feira de artesanato e produtos regionais" },
          { hora: "16:00", titulo: "Grupos folclóricos e bombos" },
          { hora: "22:00", titulo: "Cabeça de cartaz" },
          { hora: "00:00", titulo: "Grande sessão de fogo de artifício sobre o rio Lima" },
        ],
      },
      {
        dia: "Domingo, 6 de setembro",
        eventos: [
          { hora: "11:00", titulo: "Missa solene e procissão" },
          { hora: "15:00", titulo: "Desfile de gigantones e cabeçudos" },
          { hora: "18:00", titulo: "Rusgas pelas ruas da vila" },
        ],
      },
    ],
  },
};
