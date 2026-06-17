import {
  Cat,
  Car,
  AlertTriangle,
  Package,
  Flame,
  ShieldAlert,
  CloudRain,
  UserX,
  type LucideIcon,
} from "lucide-react";

export type CategoriaKey =
  | "animal_na_pista"
  | "veiculo_parado"
  | "acidente"
  | "objeto_na_pista"
  | "incendio"
  | "risco_seguranca"
  | "clima_severo"
  | "suspeita_assalto";

export const CATEGORIAS: Record<CategoriaKey, { label: string; icon: LucideIcon; cor: string; descricao: string }> = {
  animal_na_pista: { label: "Animal na pista", icon: Cat, cor: "oklch(0.78 0.15 40)", descricao: "Animal silvestre ou doméstico na pista" },
  veiculo_parado: { label: "Veículo parado", icon: Car, cor: "oklch(0.82 0.18 90)", descricao: "Veículo parado em local de risco" },
  acidente: { label: "Acidente", icon: AlertTriangle, cor: "oklch(0.65 0.24 28)", descricao: "Colisão ou capotamento" },
  objeto_na_pista: { label: "Objeto na pista", icon: Package, cor: "oklch(0.75 0.13 60)", descricao: "Carga ou objeto obstruindo a via" },
  incendio: { label: "Incêndio próximo", icon: Flame, cor: "oklch(0.68 0.23 35)", descricao: "Queimada ou incêndio próximo à rodovia" },
  risco_seguranca: { label: "Risco à segurança", icon: ShieldAlert, cor: "oklch(0.70 0.20 350)", descricao: "Situação de risco viário" },
  clima_severo: { label: "Clima severo", icon: CloudRain, cor: "oklch(0.65 0.15 230)", descricao: "Neblina densa, alagamento, tempestade" },
  suspeita_assalto: { label: "Suspeita / Assalto", icon: UserX, cor: "oklch(0.62 0.22 310)", descricao: "Tentativa de assalto ou movimentação suspeita" },
};

export const CATEGORIAS_LIST = Object.entries(CATEGORIAS).map(([key, v]) => ({ key: key as CategoriaKey, ...v }));

export const GRAVIDADE_COR: Record<string, string> = {
  baixa: "oklch(0.72 0.19 145)",
  media: "oklch(0.82 0.18 90)",
  alta: "oklch(0.70 0.22 30)",
  critica: "oklch(0.62 0.25 25)",
};