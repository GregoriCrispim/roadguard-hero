import type { LucideIcon } from "lucide-react";
import { Flame } from "lucide-react";

export type ImersaoVideo = {
  id: string;
  src: string;
  titulo?: string;
};

export type ImersaoJornada = {
  id: string;
  avatarNome: string;
  jornadaTitulo: string;
  /** Visível no card do avatar, antes de iniciar */
  descricao: string;
  /** Texto exibido imediatamente antes do primeiro vídeo */
  briefing: string;
  icone: LucideIcon;
  cor: string;
  disponivel: boolean;
  videos: ImersaoVideo[];
};

export const IMERSAO_JORNADAS: ImersaoJornada[] = [
  {
    id: "corrida-pela-vida",
    avatarNome: "Bombeiro",
    jornadaTitulo: "Corrida pela vida",
    descricao:
      "Você é o motorista de uma ambulância com um paciente em estado crítico. Cada segundo conta: chegue ao hospital o mais rápido possível, desviando do trânsito e mantendo a calma no volante.",
    briefing:
      "O socorro já foi acionado — agora a corrida é sua. Ao volante da ambulância, você transporta alguém entre a vida e a morte. Sem sirene à toa, sem manobra arriscada sem necessidade: leia a pista, antecipe cruzamentos e escolha cada rota como se o próximo minuto fosse o último. Esta é a Corrida pela vida.",
    icone: Flame,
    cor: "#DC2626",
    disponivel: true,
    videos: [
      {
        id: "cena-1",
        src: "/videos/lv__20260618095425.mp4",
        titulo: "Cena 1 — Partida de emergência",
      },
    ],
  },
];

export function getJornadaById(id: string): ImersaoJornada | undefined {
  return IMERSAO_JORNADAS.find((j) => j.id === id);
}
