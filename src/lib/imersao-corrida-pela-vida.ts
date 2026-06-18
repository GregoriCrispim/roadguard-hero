export type ImersaoVideoStep = {
  type: "video";
  id: string;
  src: string;
  titulo: string;
  autoPlay?: boolean;
};

export type ImersaoCardStep = {
  type: "card";
  id: string;
  titulo: string;
  texto: string;
  continuarLabel?: string;
};

export type ImersaoChoiceOption = {
  id: string;
  label: string;
  descricao: string;
};

export type ImersaoChoiceStep = {
  type: "choice";
  id: string;
  titulo: string;
  texto: string;
  opcoes: ImersaoChoiceOption[];
};

export type ImersaoStep = ImersaoVideoStep | ImersaoCardStep | ImersaoChoiceStep;

export const CORRIDA_PELA_VIDA_INTRO: ImersaoStep[] = [
  {
    type: "video",
    id: "partida",
    src: "/videos/lv__20260618095425.mp4",
    titulo: "Partida de emergência",
    autoPlay: true,
  },
  {
    type: "card",
    id: "a-caminho",
    titulo: "A corrida continua",
    texto:
      "A sirene ecoa e o trânsito se abre à sua frente. No banco de trás, um paciente em estado gravíssimo luta por cada segundo. O hospital está longe — e a estrada que você escolher pode ser a diferença entre a vida e a perda.",
    continuarLabel: "Seguir para o hospital",
  },
  {
    type: "video",
    id: "estrada",
    src: "/videos/lv__20260618101254.mp4",
    titulo: "Rumo ao hospital",
    autoPlay: true,
  },
  {
    type: "choice",
    id: "escolha-rodovia",
    titulo: "Qual caminho você toma?",
    texto:
      "O GPS apresenta duas rotas até o pronto-socorro. Uma passa por uma via administrada por concessionária; a outra segue estradas livres, sem praça de pedágio. O relógio não para — escolha agora.",
    opcoes: [
      {
        id: "concessionada",
        label: "Via Concessionada",
        descricao: "Pista dupla, CCO 24h, socorro integrado e praça de pedágio adiante.",
      },
      {
        id: "livre",
        label: "Rota Livre",
        descricao: "Sem pedágio, mas com mais trânsito, cruzamentos e menos infraestrutura.",
      },
    ],
  },
];

export const CORRIDA_PELA_VIDA_RAMOS: Record<string, ImersaoStep[]> = {
  concessionada: [
    {
      type: "video",
      id: "via-concessionada",
      src: "/videos/lv__20260618100457.mp4",
      titulo: "Entrando na via concessionada",
      autoPlay: true,
    },
    {
      type: "card",
      id: "beneficios-concessionaria",
      titulo: "A via concessionada protege quem corre contra o tempo",
      texto:
        "Rodovias administradas por concessionárias contam com central de controle monitorando a pista 24 horas, postos de socorro integrados, acostamento padronizado e equipes de manutenção. Em emergências como a sua, cada minuto ganho na pista pode salvar uma vida — é infraestrutura pensada para quem não pode esperar.",
      continuarLabel: "Continuar a corrida",
    },
    {
      type: "video",
      id: "chegada",
      src: "/videos/lv__20260618110228.mp4",
      titulo: "Últimos quilômetros",
      autoPlay: true,
    },
    {
      type: "card",
      id: "fim-concessionada",
      titulo: "Você chegou",
      texto:
        "A ambulância entra no hospital. A escolha pela via concessionada não eliminou o risco — mas deu a você pista, visibilidade e suporte no caminho. Na estrada, infraestrutura também salva vidas.",
      continuarLabel: "Encerrar jornada",
    },
  ],
  livre: [
    {
      type: "card",
      id: "fim-livre",
      titulo: "Rota livre escolhida",
      texto:
        "Você optou pela estrada sem pedágio. O trânsito engrossa, os cruzamentos multiplicam o risco e não há CCO te cobrindo. Esta trilha da jornada será revelada em breve — volte em breve para vivenciar o desfecho.",
      continuarLabel: "Encerrar jornada",
    },
  ],
};
