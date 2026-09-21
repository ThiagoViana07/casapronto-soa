import { GoogleGenAI, mcpToTool } from "@google/genai";
import { Client, StreamableHTTPClientTransport, } from "@modelcontextprotocol/client";
import readline from "readline/promises";
import dotenv from "dotenv";
dotenv.config();
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const MCP_SERVERS = {
    calls: "http://localhost:4001/mcp",
    customer: "http://localhost:4002/mcp", // ajuste se trocar a porta (conflito com o backend)
    provider: "http://localhost:4003/mcp",
    reviews: "http://localhost:4004/mcp",
};
if (!GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set");
}
class MCPClient {
    clients = [];
    gemini;
    constructor() {
        this.gemini = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
    }
    async connectToServers() {
        for (const [name, url] of Object.entries(MCP_SERVERS)) {
            const client = new Client({
                name: `mcp-client-${name}`,
                version: "1.0.0",
            });
            await client.connect(new StreamableHTTPClientTransport(new URL(url)));
            const { tools } = await client.listTools();
            console.log(`[${name}]`, tools.map((t) => t.name));
            this.clients.push(client);
        }
    }
    async processQuery(query) {
        const response = await this.gemini.models.generateContent({
            model: GEMINI_MODEL,
            contents: query,
            config: { tools: [mcpToTool(...this.clients, {})] },
        });
        return response.text ?? "";
    }
    async chatLoop() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        try {
            console.log("\nMCP Client Started!");
            console.log("Type your queries or 'quit' to exit.");
            while (true) {
                const message = await rl.question("\nQuery: ");
                if (message.toLowerCase() === "quit") {
                    break;
                }
                const response = await this.processQuery(message);
                console.log("\n" + response);
            }
        }
        finally {
            rl.close();
        }
    }
    async cleanup() {
        for (const client of this.clients) {
            await client.close();
        }
    }
}
async function main() {
    const mcpClient = new MCPClient();
    try {
        await mcpClient.connectToServers();
        await mcpClient.chatLoop();
    }
    catch (e) {
        console.error("Error:", e);
        process.exitCode = 1;
    }
    finally {
        await mcpClient.cleanup();
    }
}
main();
