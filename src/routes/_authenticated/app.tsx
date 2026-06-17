import { createFileRoute } from "@tanstack/react-router";
import { DriveMode } from "@/components/DriveMode";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppMapPage,
});

function AppMapPage() {
  return <DriveMode />;
}
