import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

const CUSTOMER_API_BASE =
  process.env.CUSTOMER_API_BASE ?? "http://localhost:3001/customer";

interface CustomerRecord {
  [key: string]: unknown;
}

interface CustomerApiResponse {
  status?: string;
  db?: string;
  data?: CustomerRecord[];
  [key: string]: unknown;
}

async function makeCustomerRequest<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making Customer request:", url, error);
    return null;
  }
}

function toToolResult(data: CustomerApiResponse | null, failureMessage: string) {
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

export function createCustomerServer() {
  const server = new McpServer({ name: "customer", version: "1.0.0" });

  server.registerTool(
    "get_customers",
    {
      description:
        "Lista todos os clientes cadastrados (id, nome, telefone e endereço).",
      inputSchema: z.object({}),
    },
    async () => {
      const data = await makeCustomerRequest<CustomerApiResponse>(CUSTOMER_API_BASE);
      return toToolResult(data, "Falha ao buscar clientes");
    },
  );

  server.registerTool(
    "search_customers_by_name",
    {
      description:
        "Busca clientes pelo nome (parcial, ignora maiúsculas). Retorna id, nome, " +
        "telefone e endereço. Use para descobrir o id de um cliente a partir do nome.",
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .max(100)
          .describe("Nome ou parte do nome do cliente (ex.: Fernanda)"),
      }),
    },
    async ({ name }) => {
      const url = `${CUSTOMER_API_BASE}/search?name=${encodeURIComponent(name)}`;
      const data = await makeCustomerRequest<CustomerApiResponse>(url);
      return toToolResult(data, "Falha ao buscar clientes por nome");
    },
  );

  server.registerTool(
    "get_customer_calls",
    {
      description:
        "Retorna o histórico de chamados de UM cliente, com especialidade, status, " +
        "nome do prestador e avaliação (nota e comentário). Exige o id do cliente: " +
        "se você só tem o nome, chame antes search_customers_by_name para obter o id.",
      inputSchema: z.object({
        customerId: z
          .number()
          .int()
          .positive()
          .describe("Id do cliente, obtido em get_customers ou search_customers_by_name"),
      }),
    },
    async ({ customerId }) => {
      const url = `${CUSTOMER_API_BASE}/${customerId}/calls`;
      const data = await makeCustomerRequest<CustomerApiResponse>(url);
      return toToolResult(data, "Falha ao buscar chamados do cliente");
    },
  );

  return server;
}