import express, { Application } from "express";
import pg from "pg";

const app: Application = express();

app.use(express.json());

const pool = new pg.Pool({
  host: "casapronto-postgres",
  user: "casapronto",
  password: "casapronto123",
  database: "casapronto",
  port: 5432,
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Lista todos os chamados
app.get("/calls", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM calls ORDER BY id");
    res.json({ status: "ok", db: "connected", data: result.rows });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// Resumo: total de chamados por status. GET /calls/summary
// Declarada ANTES de /calls/:id, senão "summary" seria capturado como :id.
app.get("/calls/summary", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s::text AS status, COUNT(c.id)::int AS total
         FROM unnest(enum_range(NULL::call_status)) AS s
         LEFT JOIN calls c ON c.status = s
        GROUP BY s
        ORDER BY s`,
    );
    const total = result.rows.reduce((sum, row) => sum + row.total, 0);
    res.json({ status: "ok", db: "connected", total, data: result.rows });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// Detalhe de um chamado com nomes e avaliação. GET /calls/1
app.get("/calls/:id", async (req, res) => {
  if (!/^\d{1,9}$/.test(req.params.id)) {
    res.status(400).json({ status: "error", message: '"id" deve ser um inteiro positivo' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT c.id, c.specialty, c.status, c.created_at, c.finished_at,
              cu.id AS customer_id, cu.name AS customer_name,
              p.id  AS provider_id, p.name  AS provider_name,
              r.rating, r.comment
         FROM calls c
         JOIN customers cu ON cu.id = c.customer_id
         JOIN providers p  ON p.id  = c.provider_id
         LEFT JOIN reviews r ON r.call_id = c.id
        WHERE c.id = $1`,
      [Number(req.params.id)],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ status: "error", message: "Chamado não encontrado" });
      return;
    }

    res.json({ status: "ok", db: "connected", data: result.rows });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

export default app;