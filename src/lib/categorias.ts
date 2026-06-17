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
  animal_na_pista: { label: "Animal na pista", icon: Cat, cor: "#F59E0B", descricao: "Animal silvestre ou doméstico na pista" },
  veiculo_parado: { label: "Veículo parado", icon: Car, cor: "#64748B", descricao: "Veículo parado em local de risco" },
  acidente: { label: "Acidente", icon: AlertTriangle, cor: "#DC2626", descricao: "Colisão ou capotamento" },
  objeto_na_pista: { label: "Objeto na pista", icon: Package, cor: "#8B5CF6", descricao: "Carga ou objeto obstruindo a via" },
  incendio: { label: "Incêndio próximo", icon: Flame, cor: "#EA580C", descricao: "Queimada ou incêndio próximo à rodovia" },
  risco_seguranca: { label: "Risco à segurança", icon: ShieldAlert, cor: "#EC4899", descricao: "Situação de risco viário" },
  clima_severo: { label: "Clima severo", icon: CloudRain, cor: "#005A9C", descricao: "Neblina densa, alagamento, tempestade" },
  suspeita_assalto: { label: "Suspeita / Assalto", icon: UserX, cor: "#7C3AED", descricao: "Tentativa de assalto ou movimentação suspeita" },
};

export const CATEGORIAS_LIST = Object.entries(CATEGORIAS).map(([key, v]) => ({ key: key as CategoriaKey, ...v }));

export const GRAVIDADE_COR: Record<string, string> = {
  baixa: "#4CAF50",
  media: "#F59E0B",
  alta: "#EA580C",
  critica: "#DC2626",
};