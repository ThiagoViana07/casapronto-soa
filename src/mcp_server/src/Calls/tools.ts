import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

const CALLS_API_BASE =
  process.env.CALLS_API_BASE ?? "http://localhost:3003/calls";

interface CallRecord {
  [key: string]: unknown;
}

interface CallApiResponse {
  status?: string;
  db?: string;
  data?: CallRecord[];
  [key: string]: unknown;
}

async function makeCallRequest<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making call request:", url, error);
    return null;
  }
}

function toToolResult(data: CallApiResponse | null, failureMessage: string) {
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

export function createCallsServer() {
  const server = new McpServer({ name: "calls", version: "1.0.0" });

  server.registerTool(
    "get_calls",
    {
      description:
        "Lista todos os chamados (id, customer_id, provider_id, especialidade, status " +
        "e datas de criação e conclusão). Traz apenas ids, sem nomes de cliente ou " +
        "prestador. Para nomes de um chamado específico, use get_call_by_id.",
      inputSchema: z.object({}),
    },
    async () => {
      const data = await makeCallRequest<CallApiResponse>(CALLS_API_BASE);
      return toToolResult(data, "Falha ao buscar chamados");
    },
  );

  server.registerTool(
    "get_calls_summary",
    {
      description:
        "Total de chamados por status (pending, in_progress, completed, cancelled), " +
        "já contado no banco. Use para perguntas como 'quantos chamados existem', " +
        "'quantos estão pendentes' ou 'quantos foram concluídos'.",
      inputSchema: z.object({}),
    },
    async () => {
      const data = await makeCallRequest<CallApiResponse>(`${CALLS_API_BASE}/summary`);
      return toToolResult(data, "Falha ao buscar o resumo de chamados");
    },
  );

  server.registerTool(
    "get_call_by_id",
    {
      description:
        "Detalhe de UM chamado pelo id: nome do cliente, nome do prestador, " +
        "especialidade, status, datas e a avaliação (nota e comentário), quando existir. " +
        "Use para perguntas como 'quem atendeu o chamado 7' ou 'como foi o chamado 12'.",
      inputSchema: z.object({
        callId: z
          .number()
          .int()
          .positive()
          .describe("Id do chamado, obtido em get_calls"),
      }),
    },
    async ({ callId }) => {
      const data = await makeCallRequest<CallApiResponse>(`${CALLS_API_BASE}/${callId}`);
      return toToolResult(
        data,
        `Falha ao buscar o chamado ${callId} (o id pode não existir ou a API está indisponível)`,
      );
    },
  );

  return server;
}