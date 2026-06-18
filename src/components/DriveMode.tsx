import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripMap, type TripReportMarker } from "@/components/TripMap";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useSecurityCamera } from "@/hooks/useSecurityCamera";
import { useSpeedTracker } from "@/hooks/useSpeedTracker";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { CATEGORIAS, type CategoriaKey } from "@/lib/categorias";
import { computeNavigationStats, distanceBetweenMeters, formatArrivalTime, offRouteDistanceMeters } from "@/lib/navigation";
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
import { inferReportFromNaturalSpeech, parseVoiceCommand } from "@/lib/voice-commands";
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
  Video,
  X,
} from "lucide-react";

type TripPhase = "location" | "route" | "preview" | "driving";

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
  capturing: "Gravando reporte — fale e pause 5s para enviar",
  idle: "Toque no microfone para reportar",
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
  const speedKmh = useSpeedTracker(geo.coords);
  const voice = useSpeechRecognition();

  const [phase, setPhase] = useState<TripPhase>(
    boot ? (boot.navigationStarted ? "driving" : "preview") : "location",
  );
  const [navigationActive, setNavigationActive] = useState(boot?.navigationStarted ?? false);
  const camera = useSecurityCamera(phase === "driving" && navigationActive);
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
  const autoGpsStarted = useRef(false);
  const bootSynced = useRef(false);
  const destinationRef = useRef(destination);
  const routeRef = useRef(route);
  const lastRecalcPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRecalcAtRef = useRef(0);
  const recalcInFlightRef = useRef(false);
  const navigationActiveRef = useRef(navigationActive);
  const reportLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  phaseRef.current = phase;
  coordsRef.current = geo.coords;
  tripIdRef.current = tripId;
  submittingRef.current = submitting;
  destinationRef.current = destination;
  routeRef.current = route;
  navigationActiveRef.current = navigationActive;

  useEffect(() => {
    if (!route) return;
    if (phase !== "preview" && !(phase === "driving" && navigationActive)) return;
    const id = window.setInterval(() => setNavClock((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, [phase, navigationActive, route]);

  const displayStats = useMemo(() => {
    if (!route || !geo.coords) return null;

    if (phase === "driving" && navigationActive) {
      const speedMps = speedKmh != null ? speedKmh / 3.6 : geo.coords.speed;
      return computeNavigationStats(geo.coords, route, speedMps, destination);
    }

    if (phase === "preview") {
      return {
        remainingSeconds: route.durationSeconds,
        remainingMeters: route.distanceMeters,
        arrivalTime: formatArrivalTime(route.durationSeconds),
        progress: 0,
      };
    }

    return null;
  }, [phase, navigationActive, route, geo.coords, destination, navClock, speedKmh]);

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
    setNavigationActive(false);
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
      navigationStarted?: boolean,
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
        navigationStarted: navigationStarted ?? existing?.navigationStarted ?? false,
      };
      saveTrip(stored);
    },
    [],
  );

  const applyRoute = useCallback(
    async (
      dest: GeocodeResult,
      from: { lat: number; lng: number },
      opts: { silent?: boolean; isNewTrip?: boolean; startNavigation?: boolean } = {},
    ) => {
      const { silent = false, isNewTrip = false, startNavigation = false } = opts;
      const isUpdate =
        !!tripIdRef.current && navigationActiveRef.current && phaseRef.current === "driving" && !isNewTrip;

      if (!silent) setRouting(true);

      try {
        const r = await fetchDrivingRoute(from, dest);
        const tollData = calculateTollsAlongRoute(r.coordinates, r.distanceMeters);
        const id = tripIdRef.current ?? crypto.randomUUID();
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

        if (tripIdRef.current) {
          const { error } = await supabase.from("trips").update(payload).eq("id", id);
          if (error) console.warn("Falha ao salvar viagem:", error.message);
        } else {
          const { error } = await supabase.from("trips").insert({ id, user_id: u.user.id, ...payload });
          if (error) console.warn("Falha ao salvar viagem:", error.message);
          if (isNewTrip) setTripReports([]);
        }

        setTripId(id);
        setRoute(r);
        setTolls(tollData.tolls);
        setTollTotalCents(tollData.totalCents);
        setTollEstimated(tollData.hasEstimate);
        if (!isUpdate) setTollPaid(false);

        if (startNavigation) {
          setNavigationActive(true);
          setPhase("driving");
        } else if (!silent && !navigationActiveRef.current) {
          setNavigationActive(false);
          setPhase("preview");
        }

        persistTrip(
          id,
          dest,
          r,
          tollData,
          keepReportIds,
          startNavigation || navigationActiveRef.current,
        );

        lastRecalcPosRef.current = { lat: from.lat, lng: from.lng };
        lastRecalcAtRef.current = Date.now();

        if (!silent) {
          const action = isUpdate ? "Rota atualizada" : "Percurso definido";
          speak(
            `${action}. ${formatDistance(r.distanceMeters)}, cerca de ${formatDuration(r.durationSeconds)}. Toque no microfone para reportar.`,
          );
          toast.success(
            startNavigation
              ? "Navegação iniciada"
              : isUpdate
                ? "Rota atualizada para o novo destino"
                : "Rota pronta. Toque em Iniciar para começar.",
          );
          if (tollData.totalCents > 0) setTollDialogOpen(true);
        }

        return r;
      } finally {
        if (!silent) setRouting(false);
      }
    },
    [persistTrip],
  );

  const recalculateRoute = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const dest = destinationRef.current;
      const coords = coordsRef.current;
      const currentRoute = routeRef.current;
      if (!dest || !coords || !currentRoute || recalcInFlightRef.current || !navigationActiveRef.current) {
        return;
      }

      const sinceLast = Date.now() - lastRecalcAtRef.current;
      const offRoute = offRouteDistanceMeters(coords, currentRoute.coordinates);
      const moved = lastRecalcPosRef.current
        ? distanceBetweenMeters(coords, lastRecalcPosRef.current)
        : Infinity;

      const shouldRecalc =
        (offRoute > 70 && sinceLast > 8000) || (moved > 350 && sinceLast > 40000);
      if (!shouldRecalc) return;

      recalcInFlightRef.current = true;
      try {
        await applyRoute(dest, coords, { silent: opts.silent ?? true });
      } catch {
        /* noop — próxima tentativa no intervalo */
      } finally {
        recalcInFlightRef.current = false;
      }
    },
    [applyRoute],
  );

  const submitVoiceReport = useCallback(
    async (text: string) => {
      const loc = reportLocationRef.current;
      if (!loc || !navigationActiveRef.current || submittingRef.current) return;

      setLastVoice(text);

      let categoria: CategoriaKey | null = null;
      let descricao = text.trim();

      if (!descricao) {
        toast.message("Nenhuma fala detectada. Tente novamente.");
        return;
      }

      const local = parseVoiceCommand(text);
      if (local.type === "cancel") {
        toast.message("Reporte cancelado");
        return;
      }

      if (local.type === "categoria") {
        categoria = local.categoria;
      } else {
        const inferred = inferReportFromNaturalSpeech(text);
        if (inferred && inferred.confianca >= 0.5) {
          categoria = inferred.categoria;
        } else {
          try {
            const interpreted = await interpretVoice({ data: { text } });
            if (!interpreted.isReport || !interpreted.categoria || interpreted.confianca < 0.35) {
              toast.message("Não foi possível identificar a categoria. Tente ser mais específico.");
              return;
            }
            categoria = interpreted.categoria;
            descricao = interpreted.descricao || text;
          } catch {
            toast.error("Erro ao interpretar o áudio. Tente novamente.");
            return;
          }
        }
      }

      if (!categoria) return;

      const cat = CATEGORIAS[categoria];
      const currentTripId = tripIdRef.current;
      setSubmitting(true);

      try {
        const r = await submitReport({
          categoria,
          descricao,
          lat: loc.lat,
          lng: loc.lng,
          tripId: currentTripId ?? undefined,
        });

        const marker: TripReportMarker = {
          id: r.id,
          lat: loc.lat,
          lng: loc.lng,
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
        reportLocationRef.current = null;
      }
    },
    [validar, interpretVoice, qc],
  );

  const startVoiceReport = useCallback(() => {
    if (!navigationActiveRef.current) {
      toast.error("Inicie a navegação antes de reportar");
      return false;
    }
    if (!geo.coords) {
      toast.error("Ative o GPS para reportar");
      return false;
    }
    if (!voice.supported) {
      toast.error("Use Chrome no celular para reportes por voz");
      return false;
    }

    reportLocationRef.current = { lat: geo.coords.lat, lng: geo.coords.lng };
    const ok = voice.startReportCapture((text) => {
      void submitVoiceReport(text);
    });

    if (!ok) {
      toast.error("Não foi possível iniciar o microfone. Toque novamente e permita o acesso.");
    }
    return ok;
  }, [geo.coords, voice, submitVoiceReport]);

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

      if (saved.navigationStarted) {
        setNavigationActive(true);
        setPhase("driving");
      } else {
        setPhase("preview");
      }
    })();
  }, []);

  useEffect(() => {
    if (phase !== "driving" || !navigationActive || !tripId) return;
    const stored = loadTrip();
    if (!stored) return;

    const tick = () => {
      if (isTripCompleted(stored, coordsRef.current)) finishTrip("completed");
      else if (isTripExpired(stored)) finishTrip("expired");
    };

    const id = window.setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [phase, navigationActive, tripId, finishTrip]);

  useEffect(() => {
    const q = destinationQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      searchAbortRef.current?.abort();
      const ac = new AbortController();
      searchAbortRef.current = ac;
      setSearching(true);
      try {
        setSuggestions(await searchPlaces(q, ac.signal));
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          /* noop */
        }
      } finally {
        if (!ac.signal.aborted) setSearching(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      searchAbortRef.current?.abort();
    };
  }, [destinationQuery]);

  useEffect(() => {
    if (phase !== "preview" || !destination || !geo.coords) return;

    const id = window.setInterval(() => {
      void applyRoute(destination, geo.coords!, { silent: true, isNewTrip: false });
    }, 20_000);

    return () => clearInterval(id);
  }, [phase, destination, geo.coords?.lat, geo.coords?.lng, applyRoute]);

  useEffect(() => {
    if (vehicles?.length && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  useEffect(() => {
    if (phase !== "driving" || !navigationActive || !destination || !geo.coords || !route) return;

    if (!lastRecalcPosRef.current) {
      lastRecalcPosRef.current = { lat: geo.coords.lat, lng: geo.coords.lng };
      lastRecalcAtRef.current = Date.now();
    }

    const id = window.setInterval(() => void recalculateRoute({ silent: true }), 6000);
    return () => clearInterval(id);
  }, [phase, navigationActive, destination, route?.distanceMeters, geo.coords?.lat, geo.coords?.lng, recalculateRoute]);

  async function buildRoute(dest: GeocodeResult) {
    if (!geo.coords) return toast.error("Ative a localização primeiro");

    setDestination(dest);
    setSuggestions([]);
    setDestinationQuery(dest.label.split(",")[0] ?? dest.label);
    setSearchFocused(false);

    try {
      await applyRoute(dest, geo.coords, {
        silent: false,
        isNewTrip: !tripId,
        startNavigation: navigationActive,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Não foi possível traçar a rota";
      toast.error(msg);
    }
  }

  async function startNavigation() {
    if (!destination || !geo.coords) return toast.error("Defina um destino primeiro");
    try {
      await applyRoute(destination, geo.coords, { silent: false, startNavigation: true });
      speak("Navegação iniciada. Boa viagem!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar");
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

  const showSearch = phase === "route" || phase === "preview" || phase === "driving" || searchFocused;
  const micStatus = voice.supported ? voice.status : "unsupported";
  const micLabel = MIC_LABELS[micStatus as keyof typeof MIC_LABELS] ?? MIC_LABELS.idle;
  const showNavPanel = (phase === "preview" || (phase === "driving" && navigationActive)) && route;
  const bottomInset = showNavPanel ? (phase === "preview" ? 168 : 128) : 0;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <video
        ref={camera.setVideoRef}
        className="pointer-events-none fixed h-px w-px opacity-0"
        playsInline
        muted
        autoPlay
      />

      <TripMap
        coords={geo.coords}
        route={route}
        navigating={navigationActive}
        reports={tripReports}
        tolls={tolls}
        bottomInset={bottomInset}
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
              {speedKmh != null && speedKmh > 1 && (
                <span className="rounded-full bg-card px-3 py-1 text-xs font-medium shadow">
                  {Math.round(speedKmh)} km/h
                </span>
              )}
              {phase === "driving" && navigationActive && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium shadow ${
                    voice.capturing ? "bg-destructive text-destructive-foreground" : "bg-card"
                  }`}
                >
                  {micLabel}
                </span>
              )}
              {camera.active && (
                <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white shadow">
                  Câmera · {camera.bufferMinutes} min
                </span>
              )}
              {(phase === "preview" || phase === "driving") && route && (
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

        {voice.capturing && voice.reportTranscript && (
          <div className="pointer-events-auto mx-3 mb-2 rounded-xl border border-destructive/40 bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
            <p className="text-xs text-destructive">Gravando reporte...</p>
            <p className="text-sm">&quot;{voice.reportTranscript}&quot;</p>
          </div>
        )}

        {phase === "driving" && lastVoice && !voice.capturing && (
          <div className="pointer-events-auto mx-3 mb-2 rounded-xl border bg-card/90 px-3 py-2 shadow-lg backdrop-blur">
            <p className="text-xs text-muted-foreground">Último comando</p>
            <p className="text-sm italic">&quot;{lastVoice}&quot;</p>
          </div>
        )}
      </div>

      {showNavPanel && displayStats && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/98 shadow-[0_-8px_32px_rgba(0,0,0,.12)] backdrop-blur-xl">
          <div className="px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-4xl font-bold tabular-nums leading-none">
                  {formatDuration(displayStats.remainingSeconds)}
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {formatDistance(displayStats.remainingMeters)}
                  {speedKmh != null && speedKmh > 1 && navigationActive && (
                    <span> · {Math.round(speedKmh)} km/h</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-bold tabular-nums text-primary">
                  {displayStats.arrivalTime}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  chegada
                </p>
              </div>
            </div>
            {destination && (
              <p className="mt-2 truncate text-xs text-muted-foreground">
                {destination.label.split(",").slice(0, 2).join(",")}
              </p>
            )}
            {routing && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                Recalculando rota...
              </p>
            )}
            {phase === "preview" && (
              <Button className="mt-3 w-full gap-2" size="lg" onClick={startNavigation} disabled={routing}>
                <Navigation className="h-5 w-5" />
                Iniciar
              </Button>
            )}
          </div>
        </div>
      )}

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

      {tollDialogOpen && (phase === "preview" || phase === "driving") && (
        <div
          className="pointer-events-auto absolute inset-x-3 z-50 rounded-2xl border bg-card p-4 shadow-2xl"
          style={{
            bottom: `calc(${phase === "preview" ? "11rem" : "8.5rem"} + env(safe-area-inset-bottom))`,
          }}
        >
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

      {phase === "driving" && navigationActive && (
        <>
          <button
            type="button"
            disabled={!camera.supported || camera.requesting}
            onClick={async () => {
              const res = await camera.toggle();
              if (res.error) toast.error(res.error);
              else if (res.started) toast.success("Câmera de segurança ativada");
              else if (!camera.active) toast.message("Câmera desativada");
            }}
            className={`pointer-events-auto absolute left-4 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition ${
              camera.active
                ? "bg-red-600 text-white animate-pulse"
                : camera.requesting
                  ? "bg-muted"
                  : !camera.supported
                    ? "bg-muted opacity-50"
                    : "bg-card text-foreground ring-1 ring-border"
            }`}
            style={{ bottom: "calc(8.5rem + env(safe-area-inset-bottom))" }}
            title={
              !camera.supported
                ? "Câmera não suportada neste navegador"
                : camera.active
                  ? `Gravando · ${camera.bufferMinutes} min no buffer`
                  : "Câmera de segurança (traseira)"
            }
          >
            {camera.requesting ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Video className="h-6 w-6" />
            )}
          </button>

          <button
            type="button"
            disabled={submitting || !voice.supported}
            onClick={() => {
              if (voice.capturing) voice.stop();
              else startVoiceReport();
            }}
            className={`pointer-events-auto absolute right-4 flex h-16 w-16 flex-col items-center justify-center rounded-full shadow-2xl transition ${
              voice.capturing
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : voice.status === "denied"
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground"
            }`}
            style={{ bottom: "calc(8.5rem + env(safe-area-inset-bottom))" }}
            title={micLabel}
          >
            {submitting ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : voice.capturing ? (
              <Mic className="h-7 w-7" />
            ) : (
              <MicOff className="h-7 w-7" />
            )}
          </button>
        </>
      )}

      {phase === "driving" && navigationActive && !geo.tracking && (
        <div
          className="pointer-events-auto absolute inset-x-3 z-40"
          style={{ bottom: "calc(8.5rem + env(safe-area-inset-bottom))" }}
        >
          <Button className="w-full gap-2" onClick={activateLocation}>
            <Navigation className="h-4 w-4" /> Reativar GPS
          </Button>
        </div>
      )}
    </div>
  );
}
