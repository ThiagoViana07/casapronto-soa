import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// Ajuste as portas conforme publicadas no docker-compose das suas APIs
const SERVICES = {
  customer: "http://localhost:3001",
  provider: "http://localhost:3002",
  calls: "http://localhost:3003",
  reviews: "http://localhost:3004",
};

type ServiceName = keyof typeof SERVICES;

interface Option {
  service: ServiceName;
  label: string;
  prompts: string[]; // perguntas feitas ao usuário, na ordem
  path: (answers: string[]) => string;
}

const enc = encodeURIComponent;

// Ordenadas por serviço: o menu agrupa pelo campo "service"
const OPTIONS: Option[] = [
  {
    service: "customer",
    label: "Listar clientes",
    prompts: [],
    path: () => "/customer",
  },
  {
    service: "customer",
    label: "Buscar cliente por nome",
    prompts: ["Nome (ou parte): "],
    path: ([name]) => `/customer/search?name=${enc(name)}`,
  },
  {
    service: "customer",
    label: "Histórico de chamados de um cliente",
    prompts: ["ID do cliente: "],
    path: ([id]) => `/customer/${enc(id)}/calls`,
  },
  {
    service: "provider",
    label: "Listar prestadores",
    prompts: [],
    path: () => "/provider",
  },
  {
    service: "provider",
    label: "Buscar prestador por especialidade",
    prompts: ["Especialidade (ex.: Eletricista): "],
    path: ([specialty]) => `/provider/search?specialty=${enc(specialty)}`,
  },
  {
    service: "provider",
    label: "Ranking de prestadores por nota",
    prompts: ["Especialidade (Enter para todas): ", "Limite (Enter para 5): "],
    path: ([specialty, limit]) => {
      const query = new URLSearchParams();
      if (specialty) query.set("specialty", specialty);
      if (limit) query.set("limit", limit);
      return `/provider/ranking?${query}`;
    },
  },
  {
    service: "calls",
    label: "Listar chamados",
    prompts: [],
    path: () => "/calls",
  },
  {
    service: "calls",
    label: "Resumo de chamados por status",
    prompts: [],
    path: () => "/calls/summary",
  },
  {
    service: "calls",
    label: "Detalhe de um chamado",
    prompts: ["ID do chamado: "],
    path: ([id]) => `/calls/${enc(id)}`,
  },
  {
    service: "reviews",
    label: "Listar avaliações",
    prompts: [],
    path: () => "/reviews",
  },
  {
    service: "reviews",
    label: "Resumo das avaliações",
    prompts: [],
    path: () => "/reviews/summary",
  },
  {
    service: "reviews",
    label: "Avaliações de um prestador",
    prompts: ["ID do prestador: "],
    path: ([id]) => `/reviews/provider/${enc(id)}`,
  },
];

function printMenu(): void {
  console.log("\n══════ CasaPronto · Cliente de Microserviços ══════");

  let lastService = "";
  OPTIONS.forEach((option, index) => {
    if (option.service !== lastService) {
      console.log(`\n ${option.service.toUpperCase()}  (${SERVICES[option.service]})`);
      lastService = option.service;
    }
    console.log(`   ${String(index + 1).padStart(2)}) ${option.label}`);
  });

  console.log("\n    s) Status dos serviços");
  console.log("    0) Sair");
}

// Mostra qualquer resposta no formato { status, db, ...campos, data: [...] }
function show(body: Record<string, unknown>): void {
  console.log();
  for (const [key, value] of Object.entries(body)) {
    if (key === "status" || key === "db") continue;

    const label = key === "data" ? "resultado" : key;
    if (Array.isArray(value)) {
      console.log(`${label}:`);
      if (value.length > 0) console.table(value);
      else console.log("  (nenhum resultado)");
    } else if (value !== null && typeof value === "object") {
      console.log(`${label}:`, value);
    } else {
      console.log(`${label}: ${value}`);
    }
  }
}

async function request(service: ServiceName, path: string): Promise<void> {
  const url = `${SERVICES[service]}${path}`;
  console.log(`\nGET ${url}`);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(3000) });
  } catch {
    console.log(`\n✖ Serviço "${service}" indisponível. Os demais continuam funcionando.`);
    return;
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (!res.ok) {
    console.log(`\n⚠ "${service}" respondeu HTTP ${res.status}: ${body?.message ?? "sem detalhes"}`);
    return;
  }

  if (body) show(body);
  else console.log("\n⚠ Resposta inválida do serviço.");
}

async function checkHealth(): Promise<void> {
  const lines = await Promise.all(
    Object.entries(SERVICES).map(async ([name, url]) => {
      try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
        return `${res.ok ? "🟢 ONLINE " : "🟠 ERRO   "} ${name.padEnd(9)} ${url}`;
      } catch {
        return `🔴 OFFLINE ${name.padEnd(9)} ${url}`;
      }
    }),
  );

  console.log();
  lines.forEach((line) => console.log(`  ${line}`));
}

async function main(): Promise<void> {
  const rl = createInterface({ input, output });
  rl.on("close", () => process.exit(0)); // Ctrl+C ou Ctrl+D encerram limpo

  while (true) {
    printMenu();
    const choice = (await rl.question("\nEscolha: ")).trim().toLowerCase();

    if (choice === "0") break;

    if (choice === "s") {
      await checkHealth();
    } else {
      const option = OPTIONS[Number(choice) - 1];
      if (!option) {
        console.log("\nOpção inválida.");
        continue;
      }

      const answers: string[] = [];
      for (const prompt of option.prompts) {
        answers.push((await rl.question(prompt)).trim());
      }
      await request(option.service, option.path(answers));
    }

    await rl.question("\nPressione Enter para voltar ao menu...");
  }

  rl.close();
}

main();