import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM = `Você é o Guardião Inteligente, um assistente especializado em segurança viária nas rodovias brasileiras. Responda em português do Brasil, de forma clara, prática e educativa.
- Foque exclusivamente em: animais na pista, veículos parados, acidentes, objetos na pista, incêndios, condições climáticas severas, suspeitas/assaltos e situações de risco viário.
- Nunca aborde buracos, pavimentação, iluminação ou reclamações sobre concessionárias.
- Sempre priorize: chamar 190 (polícia), 193 (bombeiros) ou 191 (PRF) em emergências.
- Use bullets quando útil. Seja conciso (no máximo 6 itens por resposta).`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages: UIMessage[] };
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM,
          messages: await convertToModelMessages(messages),
        });
        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});