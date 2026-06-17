import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/viagem")({
  beforeLoad: () => {
    throw redirect({ to: "/app", replace: true });
  },
});
