import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
const PROVIDER_API_BASE = "http://localhost:3002/provider";
// Create server instance
const server = new McpServer({
    name: "provider",
    version: "1.0.0",
});
async function makeProviderRequest(url) {
    try {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json());
    }
    catch (error) {
        console.error("Error making provider request:", error);
        return null;
    }
}
server.registerTool("get_providers", {
    description: "Lista todos os providers cadastrados na API local",
    inputSchema: z.object({}),
}, async () => {
    const providersData = await makeProviderRequest(PROVIDER_API_BASE);
    if (!providersData) {
        return {
            content: [
                {
                    type: "text",
                    text: "Falha ao buscar providers",
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(providersData, null, 2),
            },
        ],
    };
});
server.registerTool("get_provider_by_specialty", {
    description: "Busca providers por especialidade na API local",
    inputSchema: z.object({
        specialty: z.string().min(1).describe("Especialidade a ser buscada"),
    }),
}, async ({ specialty }) => {
    const encodedSpecialty = encodeURIComponent(specialty);
    const specialtyUrl = `${PROVIDER_API_BASE}/specility/${encodedSpecialty}`;
    const providersData = await makeProviderRequest(specialtyUrl);
    if (!providersData) {
        return {
            content: [
                {
                    type: "text",
                    text: "Falha ao buscar providers por especialidade",
                },
            ],
        };
    }
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(providersData, null, 2),
            },
        ],
    };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("CasaPronto MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
