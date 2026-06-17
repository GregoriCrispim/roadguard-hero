import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TripMap, type TripReportMarker } from "@/components/TripMap";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { CATEGORIAS, type CategoriaKey } from "@/lib/categorias";
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
  loadTrip,
  saveTrip,
  tripStillActive,
  type StoredTrip,
} from "@/lib/trip-storage";
import { parseVoiceCommand, VOICE_HINTS } from "@/lib/voice-commands";
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

export function DriveMode() {
  const qc = useQueryClient();
  const validar = useServerFn(validarOcorrencia);
  const payTollFn = useServerFn(payTolls);
  const geo = useGeolocation();
  const voice = useSpeechRecognition();

  const [phase, setPhase] = useState<TripPhase>("location");
  const [tripId, setTripId] = useState<string | null>(null);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [tolls, setTolls] = useState<TollOnRoute[]>([]);
  const [tollTotalCents, setTollTotalCents] = useState(0);
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
  const [restored, setRestored] = useState(false);

  const phaseRef = useRef(phase);
  const coordsRef = useRef(geo.coords);
  const tripIdRef = useRef(tripId);
  const submittingRef = useRef(false);
  const lastVoiceAtRef = useRef(0);
  const autoGpsStarted = useRef(false);

  phaseRef.current = phase;
  coordsRef.current = geo.coords;
  tripIdRef.current = tripId;
  submittingRef.current = submitting;

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

  const finishTrip = useCallback(
    async (status: "completed" | "expired") => {
      const id = tripIdRef.current;
      if (id) {
        await supabase
          .from("trips")
          .update({ status, completed_at: new Date().toISOString() })
          .eq("id", id);
      }
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
    },
    [],
  );

  const persistTrip = useCallback(
    (id: string, dest: GeocodeResult, r: RouteResult, tollData: ReturnType<typeof calculateTollsAlongRoute>) => {
      const stored: StoredTrip = {
        tripId: id,
        destination: dest,
        route: r,
        tolls: tollData.tolls,
        tollTotalCents: tollData.totalCents,
        startedAt: Date.now(),
        expiresAt: createTripExpiry(r.durationSeconds),
        reportIds: [],
      };
      saveTrip(stored);
    },
    [],
  );

  const restoreTrip = useCallback(
    async (stored: StoredTrip) => {
      setTripId(stored.tripId);
      setDestination(stored.destination);
      setRoute(stored.route);
      setTolls(stored.tolls);
      setTollTotalCents(stored.tollTotalCents);
      setDestinationQuery(stored.destination.label.split(",")[0] ?? stored.destination.label);
      setPhase("driving");

      const { data: reports } = await supabase
        .from("reports")
        .select("id, latitude, longitude, categoria")
        .eq("trip_id", stored.tripId);

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
        .eq("trip_id", stored.tripId)
        .eq("status", "paid")
        .maybeSingle();
      setTollPaid(!!paid);

      toast.success("Rota retomada");
    },
    [],
  );

  useEffect(() => {
    if (restored) return;
    const stored = loadTrip();
    if (stored && tripStillActive(stored, geo.coords)) {
      restoreTrip(stored);
    } else if (stored) {
      const status = isTripCompleted(stored, geo.coords) ? "completed" : "expired";
      supabase.from("trips").update({ status, completed_at: new Date().toISOString() }).eq("id", stored.tripId);
      clearTrip();
    }
    setRestored(true);
  }, [restored, geo.coords, restoreTrip]);

  const handleVoice = useCallback(
    async (text: string) => {
      if (phaseRef.current !== "driving" || !coordsRef.current || submittingRef.current) return;

      const now = Date.now();
      if (now - lastVoiceAtRef.current < 2500) return;
      lastVoiceAtRef.current = now;

      setLastVoice(text);
      const cmd = parseVoiceCommand(text);

      if (cmd.type === "cancel") {
        toast.message("Comando cancelado");
        speak("Cancelado");
        return;
      }

      if (cmd.type === "report_prompt") {
        toast.message("Diga o tipo de ocorrência", { description: VOICE_HINTS[0] });
        speak("Qual ocorrência deseja reportar?");
        return;
      }

      if (cmd.type === "unknown") {
        toast.error("Não entendi. Tente: animal na pista, acidente, veículo parado...");
        return;
      }

      const cat = CATEGORIAS[cmd.categoria];
      const currentCoords = coordsRef.current;
      const currentTripId = tripIdRef.current;
      setSubmitting(true);

      try {
        const r = await submitReport({
          categoria: cmd.categoria,
          descricao: `Reporte por voz: ${text}`,
          lat: currentCoords.lat,
          lng: currentCoords.lng,
          tripId: currentTripId ?? undefined,
        });

        const marker: TripReportMarker = {
          id: r.id,
          lat: currentCoords.lat,
          lng: currentCoords.lng,
          categoria: cmd.categoria,
        };
        setTripReports((prev) => [...prev, marker]);
        if (currentTripId) addReportToTrip(currentTripId, r.id);

        const res = await validar({ data: { reportId: r.id, categoria: cmd.categoria, descricao: text } });
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
    [validar, qc],
  );

  useEffect(() => {
    if (phase === "driving" && voice.supported) {
      const ok = voice.start(handleVoice);
      if (!ok) toast.error("Não foi possível iniciar o microfone");
      return () => voice.stop();
    }
  }, [phase, voice.supported, handleVoice]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (q.length < 3 || phase === "driving") {
      if (phase !== "route") setSuggestions([]);
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
  }, [destinationQuery, phase]);

  useEffect(() => {
    if (vehicles?.length && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  async function buildRoute(dest: GeocodeResult) {
    if (!geo.coords) return toast.error("Ative a localização primeiro");
    setDestination(dest);
    setSuggestions([]);
    setDestinationQuery(dest.label.split(",")[0] ?? dest.label);
    setSearchFocused(false);
    setRouting(true);

    try {
      const r = await fetchDrivingRoute(geo.coords, dest);
      const tollData = calculateTollsAlongRoute(r.coordinates);
      const id = crypto.randomUUID();
      const expiresAt = new Date(createTripExpiry(r.durationSeconds)).toISOString();

      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");

      const { error } = await supabase.from("trips").insert({
        id,
        user_id: u.user.id,
        destination_label: dest.label,
        destination_lat: dest.lat,
        destination_lng: dest.lng,
        route_coordinates: r.coordinates,
        distance_meters: r.distanceMeters,
        duration_seconds: Math.round(r.durationSeconds),
        toll_total_cents: tollData.totalCents,
        toll_details: tollData.tolls,
        status: "active",
        expires_at: expiresAt,
      });

      if (error) throw error;

      setTripId(id);
      setRoute(r);
      setTolls(tollData.tolls);
      setTollTotalCents(tollData.totalCents);
      setTollPaid(false);
      setTripReports([]);
      setPhase("driving");
      persistTrip(id, dest, r, tollData);

      const tollMsg =
        tollData.totalCents > 0
          ? ` Pedágios estimados: ${formatBRL(tollData.totalCents)}.`
          : "";
      speak(
        `Rota definida. ${formatDistance(r.distanceMeters)}, cerca de ${formatDuration(r.durationSeconds)}.${tollMsg} Pode reportar por voz.`,
      );
      toast.success("Percurso definido. Comandos de voz ativos.");
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

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <TripMap
        coords={geo.coords}
        route={route}
        tracking={geo.tracking && phase === "driving"}
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
                  onFocus={() => {
                    if (phase === "driving") {
                      toast.message("Rota ativa", {
                        description: "A rota atual permanece até você chegar ou o tempo estimado expirar.",
                      });
                      return;
                    }
                    setSearchFocused(true);
                  }}
                  readOnly={phase === "driving"}
                  placeholder={phase === "driving" ? destination?.label.split(",")[0] ?? "Em viagem" : "Para onde?"}
                  className="h-11 rounded-full border-0 bg-card pl-10 pr-10 shadow-lg"
                />
                {(searching || routing) && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
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

          {suggestions.length > 0 && showSearch && phase !== "driving" && (
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
                {geo.coords.speed != null && geo.coords.speed > 0 && (
                  <> · {(geo.coords.speed * 3.6).toFixed(0)} km/h</>
                )}
              </span>
              {phase === "driving" && route && (
                <span className="rounded-full bg-card px-3 py-1 text-xs font-medium shadow">
                  {formatDistance(route.distanceMeters)} · {formatDuration(route.durationSeconds)}
                </span>
              )}
              {phase === "driving" && tollTotalCents > 0 && (
                <button
                  type="button"
                  onClick={() => setTollDialogOpen(true)}
                  className={`rounded-full px-3 py-1 text-xs font-medium shadow ${
                    tollPaid ? "bg-emerald-600 text-white" : "bg-amber-500 text-black"
                  }`}
                >
                  Pedágio {formatBRL(tollTotalCents)} {tollPaid ? "✓ pago" : ""}
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

        {phase === "driving" && destination && (
          <div className="pointer-events-auto mx-3 mb-4 rounded-2xl border bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Destino</p>
            <p className="font-medium leading-snug">{destination.label.split(",").slice(0, 2).join(",")}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {voice.listening
                ? "Ouvindo... diga: animal na pista, acidente, veículo parado..."
                : voice.supported
                  ? "Toque no microfone para reportar por voz"
                  : "Use Chrome no celular para comandos de voz"}
            </p>
            {tripReports.length > 0 && (
              <p className="mt-1 text-xs text-primary">{tripReports.length} reporte(s) nesta viagem no mapa</p>
            )}
            {lastVoice && <p className="mt-1 text-sm italic">Último: &quot;{lastVoice}&quot;</p>}
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

      {tollDialogOpen && tollTotalCents > 0 && (
        <div className="pointer-events-auto absolute inset-x-3 bottom-24 z-50 rounded-2xl border bg-card p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold">Pedágios na rota</h3>
              <p className="text-sm text-muted-foreground">{tolls.length} praça(s) · Total {formatBRL(tollTotalCents)}</p>
            </div>
            <button type="button" onClick={() => setTollDialogOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-sm">
            {tolls.map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span>{t.name} ({t.highway})</span>
                <span className="font-medium">{formatBRL(t.priceCarCents)}</span>
              </li>
            ))}
          </ul>
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
        </div>
      )}

      {phase === "driving" && (
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            if (voice.listening) voice.stop();
            else voice.start(handleVoice);
          }}
          className={`pointer-events-auto absolute bottom-24 right-4 flex h-16 w-16 items-center justify-center rounded-full shadow-2xl transition ${
            voice.listening
              ? "bg-destructive text-destructive-foreground animate-pulse"
              : "bg-primary text-primary-foreground"
          }`}
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
