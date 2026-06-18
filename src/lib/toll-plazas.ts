export type TollPlaza = {
  id: string;
  name: string;
  highway: string;
  lat: number;
  lng: number;
  priceCarCents: number;
};

/** Praças de pedágio em rodovias concedidas (valores referência tag/eixo 2, carro). */
export const TOLL_PLAZAS: TollPlaza[] = [
  // São Paulo
  { id: "sp-imigrantes", name: "Imigrantes", highway: "SP-160", lat: -23.8512, lng: -46.7185, priceCarCents: 3420 },
  { id: "sp-anchieta", name: "Anchieta", highway: "SP-150", lat: -23.912, lng: -46.389, priceCarCents: 2890 },
  { id: "sp-cubatao", name: "Cubatão", highway: "BR-101", lat: -23.895, lng: -46.425, priceCarCents: 2650 },
  { id: "sp-castelo", name: "Castelo Branco", highway: "SP-280", lat: -23.452, lng: -46.876, priceCarCents: 3150 },
  { id: "sp-band", name: "Bandeirantes", highway: "SP-348", lat: -23.012, lng: -47.134, priceCarCents: 2780 },
  { id: "sp-raposo", name: "Raposo Tavares", highway: "SP-270", lat: -23.589, lng: -46.752, priceCarCents: 2540 },
  { id: "sp-regis", name: "Régis Bittencourt", highway: "BR-116", lat: -24.015, lng: -46.412, priceCarCents: 2980 },
  { id: "sp-dutra-1", name: "Dutra — Guarulhos", highway: "BR-116", lat: -23.462, lng: -46.533, priceCarCents: 2240 },
  { id: "sp-dutra-2", name: "Dutra — Jacareí", highway: "BR-116", lat: -23.305, lng: -45.965, priceCarCents: 2180 },
  { id: "sp-cacapava", name: "Dutra — Caçapava", highway: "BR-116", lat: -23.102, lng: -45.708, priceCarCents: 2190 },
  { id: "sp-taubate", name: "Dutra — Taubaté", highway: "BR-116", lat: -23.026, lng: -45.562, priceCarCents: 2150 },
  { id: "sp-pindamonhangaba", name: "Dutra — Pindamonhangaba", highway: "BR-116", lat: -22.924, lng: -45.462, priceCarCents: 2120 },
  { id: "sp-fernao-dias-1", name: "Fernão Dias — Atibaia", highway: "BR-381", lat: -23.118, lng: -46.552, priceCarCents: 2480 },
  { id: "sp-fernao-dias-2", name: "Fernão Dias — Bragança", highway: "BR-381", lat: -22.952, lng: -46.542, priceCarCents: 2350 },

  // Rio de Janeiro
  { id: "rj-arcored", name: "Arco Redentor", highway: "BR-101", lat: -22.903, lng: -43.178, priceCarCents: 1890 },
  { id: "rj-teresopolis", name: "Teresópolis", highway: "BR-116", lat: -22.412, lng: -42.965, priceCarCents: 2240 },
  { id: "rj-brumadinho", name: "BR-040", highway: "BR-040", lat: -20.145, lng: -44.2, priceCarCents: 1980 },
  { id: "rj-mage-1", name: "Dutra — Magé", highway: "BR-116", lat: -22.647, lng: -43.188, priceCarCents: 1980 },
  { id: "rj-mage-2", name: "Dutra — Santa Guilhermina", highway: "BR-116", lat: -22.657, lng: -43.086, priceCarCents: 1950 },
  { id: "rj-seropedica", name: "Dutra — Seropédica", highway: "BR-116", lat: -22.716, lng: -43.717, priceCarCents: 2050 },
  { id: "rj-rio-santos-1", name: "Rio-Santos — Paraty", highway: "BR-101", lat: -23.218, lng: -44.718, priceCarCents: 1780 },
  { id: "rj-rio-santos-2", name: "Rio-Santos — Angra", highway: "BR-101", lat: -23.012, lng: -44.318, priceCarCents: 1720 },

  // Minas Gerais
  { id: "mg-bh-rio", name: "Conceição do Mato Dentro", highway: "BR-381", lat: -19.032, lng: -43.425, priceCarCents: 3680 },
  { id: "mg-contagem", name: "Contagem", highway: "BR-381", lat: -19.945, lng: -44.052, priceCarCents: 2120 },
  { id: "mg-jf", name: "Juiz de Fora", highway: "BR-040", lat: -21.764, lng: -43.35, priceCarCents: 1850 },
  { id: "mg-betim", name: "Betim", highway: "BR-381", lat: -19.968, lng: -44.198, priceCarCents: 2080 },
  { id: "mg-ibirité", name: "Ibirité", highway: "BR-381", lat: -20.025, lng: -44.058, priceCarCents: 2050 },
  { id: "mg-araxa", name: "Araxá", highway: "BR-381", lat: -19.582, lng: -46.942, priceCarCents: 1920 },
  { id: "mg-uberaba", name: "Uberaba", highway: "BR-050", lat: -19.748, lng: -47.938, priceCarCents: 1880 },
  { id: "mg-bambui", name: "Bambuí", highway: "BR-262", lat: -20.038, lng: -45.978, priceCarCents: 1750 },
  { id: "mg-leopoldina", name: "Leopoldina", highway: "BR-116", lat: -21.639, lng: -42.710, priceCarCents: 1980 },
  { id: "mg-laranjal", name: "Laranjal", highway: "BR-116", lat: -21.278, lng: -42.412, priceCarCents: 1950 },
  { id: "mg-sf-gloria", name: "São Francisco do Glória", highway: "BR-116", lat: -20.824, lng: -42.321, priceCarCents: 1920 },
  { id: "mg-manhuacu", name: "São João do Manhuaçu", highway: "BR-116", lat: -20.430, lng: -42.163, priceCarCents: 1900 },
  { id: "mg-inhapim", name: "Inhapim", highway: "BR-116", lat: -19.468, lng: -42.134, priceCarCents: 1880 },
  { id: "mg-pouso-alegre", name: "Pouso Alegre", highway: "BR-381", lat: -22.228, lng: -45.936, priceCarCents: 1820 },

  // Goiás / DF
  { id: "df-brasilia", name: "Brasília Sul", highway: "BR-040", lat: -15.839, lng: -47.923, priceCarCents: 1560 },
  { id: "go-anapolis", name: "Anápolis", highway: "BR-060", lat: -16.236, lng: -48.955, priceCarCents: 1420 },
  { id: "go-rio-verde", name: "Rio Verde", highway: "BR-060", lat: -17.792, lng: -50.918, priceCarCents: 1480 },
  { id: "go-jatai", name: "Jataí", highway: "BR-060", lat: -17.878, lng: -51.718, priceCarCents: 1520 },
  { id: "go-itumbiara", name: "Itumbiara", highway: "BR-153", lat: -18.412, lng: -49.218, priceCarCents: 1580 },
  { id: "go-catalao", name: "Catalão", highway: "BR-050", lat: -18.168, lng: -47.942, priceCarCents: 1550 },

  // Paraná
  { id: "pr-curitiba", name: "Curitiba", highway: "BR-116", lat: -25.428, lng: -49.273, priceCarCents: 1950 },
  { id: "pr-litoral", name: "Litoral Paranaense", highway: "BR-277", lat: -25.542, lng: -48.512, priceCarCents: 1680 },
  { id: "pr-ponta-grossa", name: "Ponta Grossa", highway: "BR-376", lat: -25.095, lng: -50.161, priceCarCents: 1720 },
  { id: "pr-sjp", name: "São José dos Pinhais", highway: "BR-116", lat: -25.548, lng: -49.182, priceCarCents: 1850 },
  { id: "pr-campina", name: "Campina Grande do Sul", highway: "BR-116", lat: -25.305, lng: -48.982, priceCarCents: 1780 },
  { id: "pr-irati", name: "Irati", highway: "BR-153", lat: -25.468, lng: -50.652, priceCarCents: 1650 },
  { id: "pr-garuva", name: "Garuva", highway: "BR-101", lat: -26.032, lng: -48.932, priceCarCents: 1720 },
  { id: "pr-londrina", name: "Londrina", highway: "BR-369", lat: -23.312, lng: -51.162, priceCarCents: 1680 },
  { id: "pr-maringa", name: "Maringá", highway: "BR-376", lat: -23.425, lng: -51.938, priceCarCents: 1750 },

  // Santa Catarina
  { id: "sc-florianopolis", name: "Florianópolis", highway: "BR-101", lat: -27.595, lng: -48.548, priceCarCents: 1780 },
  { id: "sc-joinville", name: "Joinville", highway: "BR-101", lat: -26.304, lng: -48.845, priceCarCents: 1650 },
  { id: "sc-araquari", name: "Araquari", highway: "BR-101", lat: -26.372, lng: -48.718, priceCarCents: 1680 },
  { id: "sc-biguacu", name: "Biguaçu", highway: "BR-101", lat: -27.432, lng: -48.672, priceCarCents: 1750 },
  { id: "sc-tijucas", name: "Tijucas", highway: "BR-101", lat: -27.242, lng: -48.652, priceCarCents: 1720 },
  { id: "sc-indaial", name: "Indaial", highway: "BR-470", lat: -26.898, lng: -49.232, priceCarCents: 1620 },
  { id: "sc-porto-belo", name: "Porto Belo", highway: "BR-101", lat: -27.158, lng: -48.552, priceCarCents: 1680 },
  { id: "sc-chapeco", name: "Chapecó", highway: "BR-282", lat: -27.102, lng: -52.618, priceCarCents: 1580 },

  // Rio Grande do Sul
  { id: "rs-porto", name: "Porto Alegre", highway: "BR-116", lat: -30.034, lng: -51.217, priceCarCents: 2050 },
  { id: "rs-nova-santa-rita", name: "Nova Santa Rita", highway: "BR-116", lat: -29.852, lng: -51.082, priceCarCents: 1920 },
  { id: "rs-guaiba", name: "Guaíba", highway: "BR-116", lat: -30.102, lng: -51.322, priceCarCents: 1980 },
  { id: "rs-canoas", name: "Canoas", highway: "BR-290", lat: -29.918, lng: -51.172, priceCarCents: 1850 },
  { id: "rs-torres", name: "Torres", highway: "BR-101", lat: -29.338, lng: -49.728, priceCarCents: 1720 },
  { id: "rs-passo-fundo", name: "Passo Fundo", highway: "BR-285", lat: -28.262, lng: -52.408, priceCarCents: 1650 },

  // Bahia / Nordeste
  { id: "ba-salvador", name: "Salvador", highway: "BR-324", lat: -12.971, lng: -38.501, priceCarCents: 1920 },
  { id: "ba-feira", name: "Feira de Santana", highway: "BR-324", lat: -12.268, lng: -38.968, priceCarCents: 1780 },
  { id: "es-vitoria", name: "Vitória", highway: "BR-101", lat: -20.315, lng: -40.312, priceCarCents: 1650 },
  { id: "es-serra", name: "Serra", highway: "BR-101", lat: -20.128, lng: -40.308, priceCarCents: 1620 },
  { id: "pe-recife", name: "Recife", highway: "BR-101", lat: -8.047, lng: -34.877, priceCarCents: 1580 },
  { id: "ce-fortaleza", name: "Fortaleza", highway: "BR-116", lat: -3.731, lng: -38.526, priceCarCents: 1520 },

  // Centro-Oeste adicional
  { id: "mt-rondonopolis", name: "Rondonópolis", highway: "BR-163", lat: -16.468, lng: -54.638, priceCarCents: 1680 },
  { id: "ms-campo-grande", name: "Campo Grande", highway: "BR-262", lat: -20.442, lng: -54.648, priceCarCents: 1620 },
  { id: "to-palmas", name: "Palmas", highway: "BR-153", lat: -10.168, lng: -48.328, priceCarCents: 1550 },
];
