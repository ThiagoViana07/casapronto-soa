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

// Lista todos os providers
app.get("/provider", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM providers ORDER BY id");
    res.json({ status: "ok", db: "connected", data: result.rows });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// Busca por especialidade (parcial): GET /provider/search?specialty=eletric
app.get("/provider/search", async (req, res) => {
  const { specialty } = req.query;

  if (typeof specialty !== "string" || specialty.trim() === "" || specialty.length > 100) {
    res.status(400).json({
      status: "error",
      message: 'Query param "specialty" é obrigatório (1 a 100 caracteres)',
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT * FROM providers
        WHERE specialty ILIKE '%' || $1 || '%'
        ORDER BY name`,
      [specialty.trim()],
    );
    res.json({ status: "ok", db: "connected", data: result.rows });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// Ranking por nota média: GET /provider/ranking?specialty=limpeza&limit=3
app.get("/provider/ranking", async (req, res) => {
  const { specialty, limit } = req.query;

  if (
    specialty !== undefined &&
    (typeof specialty !== "string" || specialty.trim() === "" || specialty.length > 100)
  ) {
    res.status(400).json({
      status: "error",
      message: '"specialty" deve ter de 1 a 100 caracteres',
    });
    return;
  }

  const parsedLimit = limit === undefined ? 5 : Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 20) {
    res.status(400).json({
      status: "error",
      message: '"limit" deve ser um inteiro entre 1 e 20',
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT p.id, p.name, p.specialty,
              COUNT(c.id)::int                                          AS total_calls,
              COUNT(c.id) FILTER (WHERE c.status = 'completed')::int    AS completed_calls,
              COUNT(r.id)::int                                          AS total_reviews,
              ROUND(AVG(r.rating), 2)::float                            AS average_rating
         FROM providers p
         LEFT JOIN calls c   ON c.provider_id = p.id
         LEFT JOIN reviews r ON r.call_id = c.id
        WHERE ($1::text IS NULL OR p.specialty ILIKE '%' || $1::text || '%')
        GROUP BY p.id
        ORDER BY average_rating DESC NULLS LAST, total_reviews DESC, p.name
        LIMIT $2::int`,
      [specialty?.trim() ?? null, parsedLimit],
    );
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