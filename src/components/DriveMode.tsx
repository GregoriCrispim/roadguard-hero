import { Link } from "@tanstack/react-router";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const autoGpsStarted = useRef(false);

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

  useEffect(() => {
    if (!autoGpsStarted.current) {
      autoGpsStarted.current = true;
      geo.start();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (geo.coords && phase === "location") {
      setPhase("route");
    }
  }, [geo.coords, phase]);

  useEffect(() => {
    const q = destinationQuery.trim();
    if (q.length < 3 || phase === "driving") {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchPlaces(q);
        setSuggestions(results);
      } catch {
        /* silencioso durante digitação */
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [destinationQuery, phase]);

  async function buildRoute(dest: GeocodeResult) {
    if (!geo.coords) return toast.error("Ative a localização primeiro");
    setDestination(dest);
    setSuggestions([]);
    setDestinationQuery(dest.label.split(",")[0] ?? dest.label);
    setSearchFocused(false);
    setRouting(true);
    try {
      const r = await fetchDrivingRoute(geo.coords, dest);
      setRoute(r);
      setPhase("driving");
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

  const showSearch = phase === "route" || phase === "driving" || searchFocused;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <TripMap coords={geo.coords} route={route} tracking={geo.tracking} />

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
                  onChange={(e) => {
                    setDestinationQuery(e.target.value);
                    if (phase === "driving") {
                      setPhase("route");
                      setRoute(null);
                    }
                  }}
                  onFocus={() => setSearchFocused(true)}
                  placeholder="Para onde?"
                  className="h-11 rounded-full border-0 bg-card pl-10 pr-10 shadow-lg"
                />
                {(searching || routing) && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
                {destinationQuery && !searching && (
                  <button
                    type="button"
                    onClick={() => {
                      setDestinationQuery("");
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
                title="Ativar GPS"
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
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow">
                GPS · ±{Math.round(geo.coords.accuracy ?? 0)}m
                {geo.coords.speed != null && geo.coords.speed > 0 && (
                  <> · {(geo.coords.speed * 3.6).toFixed(0)} km/h</>
                )}
              </span>
              {phase === "driving" && route && destination && (
                <span className="rounded-full bg-card px-3 py-1 text-xs font-medium shadow">
                  {formatDistance(route.distanceMeters)} · {formatDuration(route.durationSeconds)}
                </span>
              )}
            </div>
          )}
        </header>

        <div className="flex-1" />

        {phase === "location" && (
          <div className="pointer-events-auto mx-3 mb-4 rounded-2xl border bg-card/95 p-5 shadow-2xl backdrop-blur-xl">
            <h1 className="font-display text-xl font-bold">Bem-vindo ao RoadHero</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ative sua localização para ver o mapa e buscar rotas, como no Waze.
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
              Toque em <strong>Para onde?</strong> acima e busque seu destino para traçar a rota.
            </p>
          </div>
        )}

        {phase === "driving" && destination && (
          <div className="pointer-events-auto mx-3 mb-4 rounded-2xl border bg-card/95 p-4 shadow-2xl backdrop-blur-xl">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Destino</p>
            <p className="font-medium leading-snug">{destination.label.split(",").slice(0, 2).join(",")}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {voice.supported
                ? "Diga o tipo de ocorrência para reportar. Ex: animal na pista, acidente..."
                : "Voz não suportada. Use Chrome no celular."}
            </p>
            {lastVoice && <p className="mt-1 text-sm italic">Último: &quot;{lastVoice}&quot;</p>}
          </div>
        )}
      </div>

      {menuOpen && (
        <nav className="pointer-events-auto absolute left-3 top-16 z-50 w-56 rounded-2xl border bg-card p-2 shadow-2xl">
          {[
            { to: "/painel", label: "Meu painel" },
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

      {(phase === "driving" || (geo.tracking && phase === "route")) && (
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            if (phase !== "driving") {
              toast.message("Defina uma rota primeiro para reportar por voz");
              return;
            }
            if (voice.listening) voice.stop();
            else voice.start(handleVoice);
          }}
          className={`pointer-events-auto absolute bottom-24 right-4 flex h-16 w-16 items-center justify-center rounded-full shadow-2xl transition ${
            voice.listening && phase === "driving"
              ? "bg-destructive text-destructive-foreground animate-pulse"
              : "bg-primary text-primary-foreground"
          }`}
          title={voice.listening ? "Pausar voz" : "Reportar por voz"}
        >
          {submitting ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : voice.listening && phase === "driving" ? (
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
      map.fitBounds(bounds, { padding: [80, 48] });
    })();
  }, [route]);

  return <div ref={ref} className="absolute inset-0 z-0" />;
}
