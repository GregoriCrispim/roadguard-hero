import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripMap, type TripReportMarker } from "@/components/TripMap";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { CATEGORIAS, type CategoriaKey } from "@/lib/categorias";
import { computeNavigationStats } from "@/lib/navigation";
import { payTolls } from "@/lib/pay-toll.functions";
import {
  fetchDrivingRoute,
  formatDistance,
  formatDuration,
  searchPlaces,
  type GeocodeResult,
  type RouteResult,
} from "@/lib/routing";
import { submitReport } from "@/lib/submit-report";
import { calculateTollsAlongRoute, formatBRL, type TollOnRoute } from "@/lib/tolls";
import {
  addReportToTrip,
  clearTrip,
  createTripExpiry,
  isTripCompleted,
  isTripExpired,
  loadActiveTrip,
  loadTrip,
  saveTrip,
  type StoredTrip,
} from "@/lib/trip-storage";
import { interpretVoiceReport } from "@/lib/interpret-voice-report.functions";
import { inferReportFromNaturalSpeech, parseVoiceCommand, VOICE_HINTS } from "@/lib/voice-commands";
import { validarOcorrencia } from "@/lib/validar-ocorrencia.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CreditCard,
  Loader2,
  MapPin,
  Menu,
  Mic,
  MicOff,
  Navigation,
  Search,
  X,
} from "lucide-react";

type TripPhase = "location" | "route" | "driving";

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  window.speechSynthesis.speak(utterance);
}

function getBootTrip(): StoredTrip | null {
  if (typeof window === "undefined") return null;
  return loadActiveTrip();
}

const MIC_LABELS = {
  listening: "Microfone ativo — ouvindo",
  idle: "Toque no microfone para ativar",
  prompt: "Solicitando permissão...",
  denied: "Permissão negada — toque para tentar de novo",
  error: "Erro no microfone — toque para tentar",
  unsupported: "Voz não suportada neste navegador",
} as const;

export function DriveMode() {
  const boot = getBootTrip();
  const qc = useQueryClient();
  const validar = useServerFn(validarOcorrencia);
  const interpretVoice = useServerFn(interpretVoiceReport);
  const payTollFn = useServerFn(payTolls);
  const geo = useGeolocation();
  const voice = useSpeechRecognition();

  const [phase, setPhase] = useState<TripPhase>(boot ? "driving" : "location");
  const [tripId, setTripId] = useState<string | null>(boot?.tripId ?? null);
  const [destinationQuery, setDestinationQuery] = useState(
    boot ? (boot.destination.label.split(",")[0] ?? boot.destination.label) : "",
  );
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [destination, setDestination] = useState<GeocodeResult | null>(boot?.destination ?? null);
  const [route, setRoute] = useState<RouteResult | null>(boot?.route ?? null);
  const [tolls, setTolls] = useState<TollOnRoute[]>(boot?.tolls ?? []);
  const [tollTotalCents, setTollTotalCents] = useState(boot?.tollTotalCents ?? 0);
  const [tollEstimated, setTollEstimated] = useState(
    boot?.tolls?.some((t) => t.estimated) ?? false,
  );
  const [tollPaid, setTollPaid] = useState(false);
  const [routing, setRouting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payingTolls, setPayingTolls] = useState(false);
  const [lastVoice, setLastVoice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [tollDialogOpen, setTollDialogOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [tripReports, setTripReports] = useState<TripReportMarker[]>([]);
  const [navClock, setNavClock] = useState(0);

  const phaseRef = useRef(phase);
  const coordsRef = useRef(geo.coords);
  const tripIdRef = useRef(tripId);
  const submittingRef = useRef(false);
  const lastVoiceAtRef = useRef(0);
  const handleVoiceRef = useRef<(text: string) => void>(() => {});
  const autoGpsStarted = useRef(false);
  const bootSynced = useRef(false);

  phaseRef.current = phase;
  coordsRef.current = geo.coords;
  tripIdRef.current = tripId;
  submittingRef.current = submitting;

  useEffect(() => {
    if (phase !== "driving" || !route || !geo.coords) return;
    const id = window.setInterval(() => setNavClock((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, [phase, route, geo.coords]);

  const navStats = useMemo(() => {
    if (phase !== "driving" || !route || !geo.coords) return null;
    return computeNavigationStats(geo.coords, route, geo.coords.speed, destination);
  }, [phase, route, geo.coords, destination, navClock]);

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("vehicles")
        .select("*")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const finishTrip = useCallback(async (status: "completed" | "expired") => {
    const id = tripIdRef.current;
    if (id) {
      await supabase
        .from("trips")
        .update({ status, completed_at: new Date().toISOString() })
        .eq("id", id);
    }
    voice.stop();
    clearTrip();
    setTripId(null);
    setRoute(null);
    setTolls([]);
    setTollTotalCents(0);
    setTollPaid(false);
    setTripReports([]);
    setPhase("route");
    toast.message(status === "completed" ? "Viagem concluída!" : "Rota expirada");
    if (status === "completed") speak("Viagem concluída. Boa chegada!");
  }, [voice]);

  const persistTrip = useCallback(
    (
      id: string,
      dest: GeocodeResult,
      r: RouteResult,
      tollData: ReturnType<typeof calculateTollsAlongRoute>,
      keepReportIds?: string[],
    ) => {
      const existing = loadTrip();
      const stored: StoredTrip = {
        tripId: id,
        destination: dest,
        route: r,
        tolls: tollData.tolls,
        tollTotalCents: tollData.totalCents,
        startedAt: existing?.tripId === id ? existing.startedAt : Date.now(),
        expiresAt: createTripExpiry(r.durationSeconds),
        reportIds: keepReportIds ?? (existing?.tripId === id ? existing.reportIds : []),
      };
      saveTrip(stored);
    },
    [],
  );

  const handleVoice = useCallback(
    async (text: string) => {
      if (phaseRef.current !== "driving" || !coordsRef.current || submittingRef.current) return;

      const now = Date.now();
      if (now - lastVoiceAtRef.current < 1000) return;
      lastVoiceAtRef.current = now;

      setLastVoice(text);

      let categoria: CategoriaKey | null = null;
      let descricao = text;

      const local = parseVoiceCommand(text);
      if (local.type === "cancel") {
        toast.message("Comando cancelado");
        speak("Cancelado");
        return;
      }

      if (local.type === "report_prompt") {
        toast.message("Descreva a ocorrência", { description: VOICE_HINTS[0] });
        speak("O que você está vendo na rodovia?");
        return;
      }

      if (local.type === "categoria") {
        categoria = local.categoria;
        descricao = text;
      } else {
        const inferred = inferReportFromNaturalSpeech(text);
        if (inferred && inferred.confianca >= 0.5) {
          categoria = inferred.categoria;
          descricao = text;
        } else {
          try {
            const interpreted = await interpretVoice({ data: { text } });

            if (!interpreted.isReport || !interpreted.categoria || interpreted.confianca < 0.35) {
              toast.message("Descreva a ocorrência naturalmente", {
                description: VOICE_HINTS[0],
              });
              return;
            }

            categoria = interpreted.categoria;
            descricao = interpreted.descricao || text;
          } catch {
            toast.error("Erro ao interpretar. Tente: tem um cavalo na pista, acidente à frente...");
            return;
          }
        }
      }

      if (!categoria) return;

      const cat = CATEGORIAS[categoria];
      const currentCoords = coordsRef.current;
      const currentTripId = tripIdRef.current;
      setSubmitting(true);

      try {
        const r = await submitReport({
          categoria,
          descricao: `Reporte por voz: ${descricao}`,
          lat: currentCoords.lat,
          lng: currentCoords.lng,
          tripId: currentTripId ?? undefined,
        });

        const marker: TripReportMarker = {
          id: r.id,
          lat: currentCoords.lat,
          lng: currentCoords.lng,
          categoria,
        };
        setTripReports((prev) => [...prev, marker]);
        if (currentTripId) addReportToTrip(currentTripId, r.id);

        const res = await validar({ data: { reportId: r.id, categoria, descricao } });
        qc.invalidateQueries({ queryKey: ["reports-all"] });
        qc.invalidateQueries({ queryKey: ["my-reports"] });
        qc.invalidateQueries({ queryKey: ["me"] });
        toast.success(`${cat.label} reportado · +${res.pontos} pts`);
        speak(`Reporte de ${cat.label} enviado. Mais ${res.pontos} pontos.`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao reportar";
        toast.error(msg);
        speak("Não foi possível enviar o reporte");
      } finally {
        setSubmitting(false);
      }
    },
    [validar, interpretVoice, qc],
  );

  handleVoiceRef.current = handleVoice;

  const enableMic = useCallback(() => {
    if (!voice.supported) {
      toast.error("Use Chrome no celular para comandos de voz");
      return false;
    }
    const ok = voice.enableFromGesture((text) => handleVoiceRef.current(text));
    if (!ok) {
      toast.error("Não foi possível iniciar o microfone. Toque novamente e permita o acesso.");
    }
    return ok;
  }, [voice]);

  useEffect(() => {
    if (!autoGpsStarted.current) {
      autoGpsStarted.current = true;
      geo.start();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (geo.coords && phase === "location") setPhase("route");
  }, [geo.coords, phase]);

  useEffect(() => {
    if (bootSynced.current) return;
    bootSynced.current = true;
    const saved = loadActiveTrip();
    if (!saved) return;

    (async () => {
      if (saved.route?.coordinates?.length) {
        const tollData = calculateTollsAlongRoute(
          saved.route.coordinates,
          saved.route.distanceMeters,
        );
        if (tollData.totalCents > 0 && saved.tollTotalCents <= 0) {
          setTolls(tollData.tolls);
          setTollTotalCents(tollData.totalCents);
          setTollEstimated(tollData.hasEstimate);
        } else if (saved.tolls?.some((t) => t.estimated)) {
          setTollEstimated(true);
        }
      }

      const { data: reports } = await supabase
        .from("reports")
        .select("id, latitude, longitude, categoria")
        .eq("trip_id", saved.tripId);

      if (reports?.length) {
        setTripReports(
          reports.map((r) => ({
            id: r.id,
            lat: r.latitude,
            lng: r.longitude,
            categoria: r.categoria as CategoriaKey,
          })),
        );
      }

      const { data: paid } = await supabase
        .from("toll_payments")
        .select("id")
        .eq("trip_id", saved.tripId)
        .eq("status", "paid")
        .maybeSingle();
      setTollPaid(!!paid);
    })();
  }, []);

  useEffect(() => {
    if (phase !== "driving" || !tripId) return;
    const stored = loadTrip();
    if (!stored) return;

    const tick = () => {
      if (isTripCompleted(stored, coordsRef.current)) finishTrip("completed");
      else if (isTripExpired(stored)) finishTrip("expired");
    };

    const id = window.setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [phase, tripId, finishTrip]);

  useEffect(() => {
    const q = destinationQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        setSuggestions(await searchPlaces(q));
      } catch {
        /* noop */
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [destinationQuery]);

  useEffect(() => {
    if (vehicles?.length && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  async function buildRoute(dest: GeocodeResult) {
    if (!geo.coords) return toast.error("Ative a localização primeiro");
    const isUpdate = !!tripId && phase === "driving";

    setDestination(dest);
    setSuggestions([]);
    setDestinationQuery(dest.label.split(",")[0] ?? dest.label);
    setSearchFocused(false);
    setRouting(true);

    try {
      const r = await fetchDrivingRoute(geo.coords, dest);
      const tollData = calculateTollsAlongRoute(r.coordinates, r.distanceMeters);
      const id = tripId ?? crypto.randomUUID();
      const expiresAt = new Date(createTripExpiry(r.durationSeconds)).toISOString();
      const existing = loadTrip();
      const keepReportIds = isUpdate && existing?.tripId === id ? existing.reportIds : [];

      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");

      const payload = {
        destination_label: dest.label,
        destination_lat: dest.lat,
        destination_lng: dest.lng,
        route_coordinates: r.coordinates,
        distance_meters: r.distanceMeters,
        duration_seconds: Math.round(r.durationSeconds),
        toll_total_cents: tollData.totalCents,
        toll_details: tollData.tolls,
        status: "active" as const,
        expires_at: expiresAt,
      };

      if (tripId) {
        const { error } = await supabase.from("trips").update(payload).eq("id", tripId);
        if (error) console.warn("Falha ao salvar viagem:", error.message);
      } else {
        const { error } = await supabase.from("trips").insert({ id, user_id: u.user.id, ...payload });
        if (error) console.warn("Falha ao salvar viagem:", error.message);
        setTripReports([]);
      }

      setTripId(id);
      setRoute(r);
      setTolls(tollData.tolls);
      setTollTotalCents(tollData.totalCents);
      setTollEstimated(tollData.hasEstimate);
      if (!isUpdate) setTollPaid(false);
      setPhase("driving");
      persistTrip(id, dest, r, tollData, keepReportIds);

      const action = isUpdate ? "Rota atualizada" : "Percurso definido";
      speak(
        `${action}. ${formatDistance(r.distanceMeters)}, cerca de ${formatDuration(r.durationSeconds)}. Toque no microfone para reportar.`,
      );
      toast.success(isUpdate ? "Rota atualizada para o novo destino" : "Percurso definido. Toque no microfone para reportar por voz.");
      if (tollData.totalCents > 0) setTollDialogOpen(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Não foi possível traçar a rota";
      toast.error(msg);
    } finally {
      setRouting(false);
    }
  }

  async function handlePayTolls() {
    if (!tripId || tollTotalCents <= 0) return;
    if (!selectedVehicleId) {
      toast.error("Cadastre e selecione um veículo em Meus veículos");
      return;
    }
    setPayingTolls(true);
    try {
      const res = await payTollFn({
        data: {
          tripId,
          vehicleId: selectedVehicleId,
          amountCents: tollTotalCents,
          tollDetails: tolls,
        },
      });
      setTollPaid(true);
      setTollDialogOpen(false);
      toast.success(`Pedágio pago · ${formatBRL(res.amountCents)} · ${res.placa}`);
      speak(`Pagamento de pedágio confirmado para o veículo ${res.placa}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha no pagamento");
    } finally {
      setPayingTolls(false);
    }
  }

  function activateLocation() {
    geo.start();
    toast.success("Localização ativada");
  }

  const showSearch = phase === "route" || phase === "driving" || searchFocused;
  const micStatus = voice.supported ? voice.status : "unsupported";
  const micLabel = MIC_LABELS[micStatus as keyof typeof MIC_LABELS] ?? MIC_LABELS.idle;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <TripMap
        coords={geo.coords}
        route={route}
        navigating={phase === "driving"}
        reports={tripReports}
        tolls={tolls}
      />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header className="pointer-events-auto space-y-2 bg-gradient-to-b from-background/95 via-background/80 to-transparent px-3 pb-3 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card shadow-lg"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {showSearch ? (
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={destinationQuery}
                  onChange={(e) => setDestinationQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 200)}
                  placeholder={phase === "driving" ? "Alterar destino..." : "Para onde?"}
                  className="h-11 rounded-full border-0 bg-card pl-10 pr-10 shadow-lg"
                />
                {(searching || routing) && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
                {destinationQuery && !searching && !routing && (
                  <button
                    type="button"
                    onClick={() => {
                      setDestinationQuery(phase === "driving" && destination
                        ? destination.label.split(",")[0] ?? ""
                        : "");
                      setSuggestions([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 rounded-full bg-card px-4 py-2.5 text-sm font-medium shadow-lg">
                RoadHero · Ative o GPS para buscar rotas
              </div>
            )}

            {!geo.tracking && (
              <button
                type="button"
                onClick={activateLocation}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
              >
                <MapPin className="h-5 w-5" />
              </button>
            )}
          </div>

          {suggestions.length > 0 && showSearch && (
            <ul className="max-h-52 overflow-y-auto rounded-2xl border bg-card shadow-2xl">
              {suggestions.map((s) => (
                <li key={`${s.lat}-${s.lng}`}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm hover:bg-surface"
                    onClick={() => buildRoute(s)}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {geo.tracking && geo.coords && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow">
                GPS · ±{Math.round(geo.coords.accuracy ?? 0)}m
              </span>
              {phase === "driving" && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium shadow ${
                    voice.listening ? "bg-destructive text-destructive-foreground" : "bg-card"
                  }`}
                >
                  {micLabel}
                </span>
              )}
              {phase === "driving" && route && (
                <button
                  type="button"
                  onClick={() => setTollDialogOpen(true)}
                  className={`rounded-full px-3 py-1 text-xs font-medium shadow ${
                    tollTotalCents <= 0
                      ? "bg-card"
                      : tollPaid
                        ? "bg-emerald-600 text-white"
                        : "bg-amber-500 text-black"
                  }`}
                >
                  {tollTotalCents > 0
                    ? `Pedágio ${formatBRL(tollTotalCents)}${tollEstimated ? " (est.)" : ""} ${tollPaid ? "✓" : ""}`
                    : "Ver pedágios"}
                </button>
              )}
            </div>
          )}

          {phase === "driving" && route && navStats && (
            <div className="rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur">
              <div className="flex items-center gap-4">
                <div className="shrink-0">
                  <p className="font-display text-3xl font-bold tabular-nums leading-none text-primary">
                    {navStats.arrivalTime}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    chegada prevista
                  </p>
                </div>
                <div className="h-11 w-px shrink-0 bg-border" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <p className="text-lg font-bold tabular-nums">
                      {formatDuration(navStats.remainingSeconds)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      · {formatDistance(navStats.remainingMeters)}
                    </p>
                    {geo.coords?.speed != null && geo.coords.speed > 0.5 && (
                      <p className="text-sm text-muted-foreground">
                        · {(geo.coords.speed * 3.6).toFixed(0)} km/h
                      </p>
                    )}
                  </div>
                  {destination && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      → {destination.label.split(",").slice(0, 2).join(",")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </header>

        <div className="flex-1" />

        {phase === "location" && (
          <div className="pointer-events-auto mx-3 mb-4 rounded-2xl border bg-card/95 p-5 shadow-2xl backdrop-blur-xl">
            <h1 className="font-display text-xl font-bold">Bem-vindo ao RoadHero</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ative sua localização para ver o mapa e buscar rotas.
            </p>
            {geo.error && <p className="mt-2 text-sm text-destructive">{geo.error}</p>}
            <Button size="lg" className="mt-4 w-full gap-2" onClick={activateLocation} disabled={geo.tracking}>
              <MapPin className="h-5 w-5" />
              {geo.tracking ? "Localizando..." : "Ativar localização"}
            </Button>
          </div>
        )}

        {phase === "route" && !destinationQuery && !searchFocused && (
          <div className="pointer-events-auto mx-3 mb-4 rounded-2xl border bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
            <p className="text-sm text-muted-foreground">
              Busque seu destino em <strong>Para onde?</strong> — a rota permanece até o fim da viagem ou expiração do tempo estimado.
            </p>
          </div>
        )}

        {phase === "driving" && lastVoice && (
          <div className="pointer-events-auto mx-3 mb-2 rounded-xl border bg-card/90 px-3 py-2 shadow-lg backdrop-blur">
            <p className="text-xs text-muted-foreground">Último comando</p>
            <p className="text-sm italic">&quot;{lastVoice}&quot;</p>
          </div>
        )}
      </div>

      {menuOpen && (
        <nav className="pointer-events-auto absolute left-3 top-16 z-50 w-56 rounded-2xl border bg-card p-2 shadow-2xl">
          {[
            { to: "/painel", label: "Meu painel" },
            { to: "/veiculos", label: "Meus veículos" },
            { to: "/mapa", label: "Ocorrências no mapa" },
            { to: "/reportar", label: "Reportar manual" },
            { to: "/ranking", label: "Ranking" },
            { to: "/recompensas", label: "Recompensas" },
            { to: "/guardiao", label: "Guardião IA" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-surface"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}

      {tollDialogOpen && phase === "driving" && (
        <div className="pointer-events-auto absolute inset-x-3 bottom-28 z-50 rounded-2xl border bg-card p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold">Pedágios na rota</h3>
              <p className="text-sm text-muted-foreground">
                {tollTotalCents > 0
                  ? `${tolls.length} praça(s) · Total ${formatBRL(tollTotalCents)}${tollEstimated ? " (estimativa)" : ""}`
                  : "Nenhum pedágio detectado nesta rota"}
              </p>
            </div>
            <button type="button" onClick={() => setTollDialogOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          {tolls.length > 0 ? (
            <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-sm">
              {tolls.map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span>{t.name} ({t.highway})</span>
                  <span className="font-medium">{formatBRL(t.priceCarCents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Rotas curtas ou urbanas podem não ter pedágio. Tente uma rota interestadual mais longa.
            </p>
          )}
          {tollTotalCents > 0 && (
            <div className="mt-4 space-y-2">
              <Label>Veículo para pagamento</Label>
              {!vehicles?.length ? (
                <p className="text-sm text-muted-foreground">
                  <Link to="/veiculos" className="text-primary underline" onClick={() => setMenuOpen(false)}>
                    Cadastre uma placa
                  </Link>{" "}
                  para pagar antecipado.
                </p>
              ) : (
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa}{v.apelido ? ` · ${v.apelido}` : ""}
                    </option>
                  ))}
                </select>
              )}
              <Button
                className="w-full gap-2"
                disabled={payingTolls || tollPaid || !vehicles?.length}
                onClick={handlePayTolls}
              >
                {payingTolls ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {tollPaid ? "Pedágio já pago" : `Pagar ${formatBRL(tollTotalCents)} antecipado`}
              </Button>
            </div>
          )}
        </div>
      )}

      {phase === "driving" && (
        <button
          type="button"
          disabled={submitting || !voice.supported}
          onClick={() => {
            if (voice.listening) {
              voice.stop();
            } else {
              enableMic();
            }
          }}
          className={`pointer-events-auto absolute bottom-28 right-4 flex h-16 w-16 flex-col items-center justify-center rounded-full shadow-2xl transition ${
            voice.listening
              ? "bg-destructive text-destructive-foreground animate-pulse"
              : voice.status === "denied"
                ? "bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground"
          }`}
          title={micLabel}
        >
          {submitting ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : voice.listening ? (
            <Mic className="h-7 w-7" />
          ) : (
            <MicOff className="h-7 w-7" />
          )}
        </button>
      )}

      {phase === "driving" && !geo.tracking && (
        <div className="pointer-events-auto absolute bottom-4 left-3 right-3">
          <Button className="w-full gap-2" onClick={activateLocation}>
            <Navigation className="h-4 w-4" /> Reativar GPS
          </Button>
        </div>
      )}
    </div>
  );
}
