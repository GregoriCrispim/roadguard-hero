import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect, useRef } from "react";

type Props = {
  onScan: (codigo: string) => void;
  active?: boolean;
};

export function QrScanner({ onScan, active = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 8, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
      false,
    );
    scannerRef.current = scanner;

    scanner.render(
      (decoded) => {
        const raw = decoded.trim().toUpperCase();
        const match = raw.match(/RH-[A-Z0-9]{8}/) ?? raw.match(/[A-Z0-9-]{6,}/);
        if (match) onScan(match[0]);
      },
      () => {},
    );

    return () => {
      void scanner.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [active, onScan]);

  return (
    <div ref={containerRef} className="overflow-hidden rounded-xl border bg-black/5">
      <div id="qr-reader" className="w-full [&_video]:rounded-xl" />
    </div>
  );
}
