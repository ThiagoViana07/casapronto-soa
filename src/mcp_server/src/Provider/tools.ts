import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

const PROVIDER_API_BASE =
  process.env.PROVIDER_API_BASE ?? "http://localhost:3002/provider";

interface ProviderRecord {
  id?: number | string;
  name?: string;
  specialty?: string;
  [key: string]: unknown;
}

interface ProviderApiResponse {
  status?: string;
  db?: string;
  data?: ProviderRecord[];
  [key: string]: unknown;
}

async function makeProviderRequest<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making provider request:", url, error);
    return null;
  }
}

function toToolResult(data: ProviderApiResponse | null, failureMessage: string) {
  if (!data) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: failureMessage }],
    };
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createProviderServer() {
  const server = new McpServer({ name: "provider", version: "1.0.0" });

  server.registerTool(
    "get_providers",
    {
      description:
        "Lista todos os prestadores cadastrados (id, nome, especialidade e telefone).",
      inputSchema: z.object({}),
    },
    async () => {
      const data = await makeProviderRequest<ProviderApiResponse>(PROVIDER_API_BASE);
      return toToolResult(data, "Falha ao buscar prestadores");
    },
  );

  server.registerTool(
    "get_provider_by_specialty",
    {
      description:
        "Busca prestadores por especialidade. Use o nome da especialidade como " +
        "cadastrado: Eletricista, Encanamento, Jardinagem, Limpeza ou Pintura. " +
        "A busca é parcial, então 'eletric' também encontra 'Eletricista'.",
      inputSchema: z.object({
        specialty: z
          .string()
          .min(1)
          .max(100)
          .describe("Nome da especialidade (ex.: Eletricista, Encanamento)"),
      }),
    },
    async ({ specialty }) => {
      const url = `${PROVIDER_API_BASE}/search?specialty=${encodeURIComponent(specialty)}`;
      const data = await makeProviderRequest<ProviderApiResponse>(url);
      return toToolResult(data, "Falha ao buscar prestadores por especialidade");
    },
  );

  server.registerTool(
    "get_provider_ranking",
    {
      description:
        "Ranking de prestadores pela nota média das avaliações, já calculado no banco. " +
        "Use para perguntas como 'quem é o melhor prestador', 'mais bem avaliado' ou " +
        "'top 3'. Retorna id, nome, especialidade, nota média, total de avaliações e " +
        "total de chamados. Prestadores sem avaliação aparecem no fim, com nota nula. " +
        "Pode filtrar por especialidade: Eletricista, Encanamento, Jardinagem, Limpeza ou Pintura.",
      inputSchema: z.object({
        specialty: z
          .string()
          .min(1)
          .max(100)
          .optional()
          .describe("Filtra o ranking por especialidade (opcional)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Quantidade máxima de prestadores no ranking (opcional, padrão 5)"),
      }),
    },
    async ({ specialty, limit }) => {
      const query = new URLSearchParams();
      if (specialty) query.set("specialty", specialty);
      if (limit !== undefined) query.set("limit", String(limit));

      const suffix = query.size > 0 ? `?${query}` : "";
      const data = await makeProviderRequest<ProviderApiResponse>(
        `${PROVIDER_API_BASE}/ranking${suffix}`,
      );
      return toToolResult(data, "Falha ao buscar o ranking de prestadores");
    },
  );

  return server;
}