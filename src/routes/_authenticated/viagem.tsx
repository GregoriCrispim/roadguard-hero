import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { CATEGORIAS, type CategoriaKey } from "@/lib/categorias";
import {
  fetchDrivingRoute,
  formatDistance,
  formatDuration,
  searchPlaces,
  type GeocodeResult,
  type RouteResult,
} from "@/lib/routing";
import { submitReport } from "@/lib/submit-report";
import { parseVoiceCommand, VOICE_HINTS } from "@/lib/voice-commands";
import { validarOcorrencia } from "@/lib/validar-ocorrencia.functions";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Navigation,
  Search,
  Route as RouteIcon,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/viagem")({
  component: ViagemPage,
});

type TripPhase = "location" | "route" | "driving";

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  window.speechSynthesis.speak(utterance);
}

function ViagemPage() {
  const qc = useQueryClient();
  const validar = useServerFn(validarOcorrencia);
  const geo = useGeolocation();
  const voice = useSpeechRecognition();

  const [phase, setPhase] = useState<TripPhase>("location");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [destination, setDestination] = useState<GeocodeResult | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routing, setRouting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastVoice, setLastVoice] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);

  const handleVoice = useCallback(
    async (text: string) => {
      if (phase !== "driving" || !geo.coords) return;
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
      setSubmitting(true);
      try {
        const r = await submitReport({
          categoria: cmd.categoria,
          descricao: `Reporte por voz: ${text}`,
          lat: geo.coords.lat,
          lng: geo.coords.lng,
        });
        const res = await validar({ data: { reportId: r.id, categoria: cmd.categoria, descricao: text } });
        qc.invalidateQueries({ queryKey: ["reports-all"] });
        qc.invalidateQueries({ queryKey: ["my-reports"] });
        qc.invalidateQueries({ queryKey: ["me"] });
        toast.success(`${cat.label} reportado · +${res.pontos} pts`);
        speak(`Reporte de ${cat.label} enviado. Mais ${res.pontos} pontos.`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erro ao reportar";
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [phase, geo.coords, validar, qc],
  );

  useEffect(() => {
    if (phase === "driving" && voice.supported) {
      voice.start(handleVoice);
      return () => voice.stop();
    }
  }, [phase, voice.supported]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSearchPlaces() {
    if (destinationQuery.trim().length < 3) return;
    setSearching(true);
    try {
      const results = await searchPlaces(destinationQuery);
      setSuggestions(results);
      if (!results.length) toast.error("Nenhum local encontrado");
    } catch {
      toast.error("Erro ao buscar endereço");
    } finally {
      setSearching(false);
    }
  }

  async function buildRoute(dest: GeocodeResult) {
    if (!geo.coords) return toast.error("Ative a localização primeiro");
    setDestination(dest);
    setSuggestions([]);
    setDestinationQuery(dest.label.split(",")[0] ?? dest.label);
    setRouting(true);
    try {
      const r = await fetchDrivingRoute(geo.coords, dest);
      setRoute(r);
      setPhase("driving");
      setPanelOpen(false);
      speak(`Rota definida. ${formatDistance(r.distanceMeters)}, cerca de ${formatDuration(r.durationSeconds)}. Pode reportar por voz.`);
      toast.success("Percurso definido. Comandos de voz ativos.");
    } catch {
      toast.error("Não foi possível traçar a rota");
    } finally {
      setRouting(false);
    }
  }

  function activateLocation() {
    geo.start();
    toast.success("Localização ativada");
  }

  useEffect(() => {
    if (geo.coords && phase === "location") {
      setPhase("route");
    }
  }, [geo.coords, phase]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <TripMap coords={geo.coords} route={route} tracking={geo.tracking} />

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header className="pointer-events-auto flex items-center justify-between gap-2 bg-gradient-to-b from-background/95 to-transparent px-3 pb-2 pt-3">
          <Link to="/app" className="flex h-10 w-10 items-center justify-center rounded-full bg-card/90 shadow-lg backdrop-blur">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="rounded-full bg-card/90 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur">
            {phase === "location" && "Ativar GPS"}
            {phase === "route" && "Definir percurso"}
            {phase === "driving" && "Em viagem"}
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card/90 shadow-lg backdrop-blur"
          >
            {panelOpen ? <X className="h-5 w-5" /> : <RouteIcon className="h-5 w-5" />}
          </button>
        </header>

        {geo.tracking && geo.coords && (
          <div className="pointer-events-auto mx-3 mt-1 self-start rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow">
            GPS · ±{Math.round(geo.coords.accuracy ?? 0)}m
            {geo.coords.speed != null && geo.coords.speed > 0 && (
              <> · {(geo.coords.speed * 3.6).toFixed(0)} km/h</>
            )}
          </div>
        )}

        <div className="flex-1" />

        {panelOpen && (
          <div className="pointer-events-auto mx-3 mb-4 rounded-2xl border border-border/60 bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
            {phase === "location" && (
              <div className="space-y-4">
                <div>
                  <h1 className="font-display text-xl font-bold">Modo viagem</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ative o GPS para acompanhar sua posição em tempo real, como no Waze.
                  </p>
                </div>
                {geo.error && <p className="text-sm text-destructive">{geo.error}</p>}
                <Button size="lg" className="w-full gap-2" onClick={activateLocation} disabled={geo.tracking}>
                  <MapPin className="h-5 w-5" />
                  {geo.tracking ? "Localizando..." : "Ativar localização"}
                </Button>
              </div>
            )}

            {phase === "route" && (
              <div className="space-y-3">
                <div>
                  <h2 className="font-display text-lg font-bold">Para onde vai?</h2>
                  <p className="text-sm text-muted-foreground">Busque o destino para traçar o percurso.</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={destinationQuery}
                    onChange={(e) => setDestinationQuery(e.target.value)}
                    placeholder="Cidade, rodovia ou endereço..."
                    onKeyDown={(e) => e.key === "Enter" && handleSearchPlaces()}
                  />
                  <Button variant="secondary" size="icon" onClick={handleSearchPlaces} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {suggestions.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto rounded-xl border bg-background">
                    {suggestions.map((s) => (
                      <li key={`${s.lat}-${s.lng}`}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-surface"
                          onClick={() => buildRoute(s)}
                        >
                          {s.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {routing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Calculando rota...
                  </div>
                )}
              </div>
            )}

            {phase === "driving" && destination && route && (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Destino</p>
                    <p className="font-medium leading-snug">{destination.label.split(",").slice(0, 2).join(",")}</p>
                    <p className="mt-1 text-sm text-primary">
                      {formatDistance(route.distanceMeters)} · {formatDuration(route.durationSeconds)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPhase("route");
                      setRoute(null);
                      setPanelOpen(true);
                    }}
                  >
                    Alterar
                  </Button>
                </div>

                <div className="rounded-xl bg-surface p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Comandos de voz</p>
                  <p className="mt-1 text-sm">
                    {voice.supported
                      ? "Diga o tipo de ocorrência enquanto dirige."
                      : "Voz não suportada neste navegador. Use Chrome no celular."}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {VOICE_HINTS.map((h) => (
                      <li key={h}>• {h}</li>
                    ))}
                  </ul>
                  {lastVoice && (
                    <p className="mt-2 text-sm italic text-foreground">Último: &quot;{lastVoice}&quot;</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {phase === "driving" && (
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            if (voice.listening) voice.stop();
            else voice.start(handleVoice);
          }}
          className={`pointer-events-auto absolute bottom-28 right-4 flex h-16 w-16 items-center justify-center rounded-full shadow-2xl transition ${
            voice.listening ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-primary text-primary-foreground"
          }`}
          title={voice.listening ? "Pausar voz" : "Ativar voz"}
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

function TripMap({
  coords,
  route,
  tracking,
}: {
  coords: { lat: number; lng: number; heading: number | null } | null;
  route: RouteResult | null;
  tracking: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const userMarkerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const routeLayerRef = useRef<import("leaflet").Polyline | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined" || !ref.current || mapRef.current) return;
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled) return;

      const map = L.map(ref.current, { zoomControl: false }).setView([-15.78, -47.93], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OSM",
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !coords) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current!;

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.circleMarker([coords.lat, coords.lng], {
          radius: 10,
          color: "#fff",
          weight: 3,
          fillColor: "#2563EB",
          fillOpacity: 1,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([coords.lat, coords.lng]);
      }

      if (tracking) {
        map.setView([coords.lat, coords.lng], Math.max(map.getZoom(), 15), { animate: true });
      }
    })();
  }, [coords, tracking]);

  useEffect(() => {
    if (!mapRef.current || !route?.coordinates.length) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current!;

      routeLayerRef.current?.remove();
      routeLayerRef.current = L.polyline(route.coordinates, {
        color: "#2563EB",
        weight: 6,
        opacity: 0.85,
      }).addTo(map);

      const bounds = routeLayerRef.current.getBounds();
      map.fitBounds(bounds, { padding: [48, 48] });
    })();
  }, [route]);

  return <div ref={ref} className="absolute inset-0 z-0" />;
}
