import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createCallsServer } from "./Calls/tools.js";
import { createCustomerServer } from "./Customer/tools.js";
import { createProviderServer } from "./Provider/tools.js";
import { createReviewsServer } from "./Reviews/tools.js";

const services = {
  calls: createCallsServer,
  customer: createCustomerServer,
  provider: createProviderServer,
  reviews: createReviewsServer,
};

const serviceName = process.env.SERVICE ?? "";
const createServer = services[serviceName as keyof typeof services];

if (!createServer) {
  throw new Error(
    `SERVICE inválido: "${serviceName}". Use: ${Object.keys(services).join(", ")}`,
  );
}

const app = createMcpExpressApp({ host: "0.0.0.0" });

app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3000, () => console.log(`MCP "${serviceName}" rodando na porta 3000`));