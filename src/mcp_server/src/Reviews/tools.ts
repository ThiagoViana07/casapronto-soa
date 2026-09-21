import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

const REVIEWS_API_BASE =
  process.env.REVIEWS_API_BASE ?? "http://localhost:3004/reviews";

interface ReviewsRecord {
  [key: string]: unknown;
}

interface ReviewsApiResponse {
  status?: string;
  db?: string;
  data?: ReviewsRecord[];
  [key: string]: unknown;
}

async function makeReviewsRequest<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making Reviews request:", url, error);
    return null;
  }
}

function toToolResult(data: ReviewsApiResponse | null, failureMessage: string) {
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

export function createReviewsServer() {
  const server = new McpServer({ name: "reviews", version: "1.0.0" });

  server.registerTool(
    "get_reviews",
    {
      description:
        "Lista todas as avaliações (id, call_id, provider_id, nota de 1 a 5 e comentário). " +
        "Traz apenas ids, sem nomes. Para avaliações de um prestador com o nome de " +
        "quem avaliou, use get_reviews_by_provider.",
      inputSchema: z.object({}),
    },
    async () => {
      const data = await makeReviewsRequest<ReviewsApiResponse>(REVIEWS_API_BASE);
      return toToolResult(data, "Falha ao buscar avaliações");
    },
  );

  server.registerTool(
    "get_reviews_summary",
    {
      description:
        "Resumo geral das avaliações, calculado no banco: total de avaliações, nota " +
        "média geral e quantas avaliações existem para cada nota de 1 a 5. Use para " +
        "perguntas como 'qual a nota média geral' ou 'quantas avaliações têm nota 5'.",
      inputSchema: z.object({}),
    },
    async () => {
      const data = await makeReviewsRequest<ReviewsApiResponse>(`${REVIEWS_API_BASE}/summary`);
      return toToolResult(data, "Falha ao buscar o resumo das avaliações");
    },
  );

  server.registerTool(
    "get_reviews_by_provider",
    {
      description:
        "Avaliações de UM prestador, com nota, comentário e o nome do cliente que " +
        "avaliou. Exige o id do prestador: se você só tem o nome, obtenha o id antes " +
        "com get_providers ou get_provider_by_specialty.",
      inputSchema: z.object({
        providerId: z
          .number()
          .int()
          .positive()
          .describe("Id do prestador, obtido em get_providers ou get_provider_by_specialty"),
      }),
    },
    async ({ providerId }) => {
      const data = await makeReviewsRequest<ReviewsApiResponse>(
        `${REVIEWS_API_BASE}/provider/${providerId}`,
      );
      return toToolResult(
        data,
        `Falha ao buscar avaliações do prestador ${providerId} (o id pode não existir ou a API está indisponível)`,
      );
    },
  );

  return server;
}