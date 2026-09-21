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

// Lista todas as avaliações
app.get("/reviews", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM reviews ORDER BY id");
    res.json({ status: "ok", db: "connected", data: result.rows });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// Resumo geral: total, nota média e distribuição. GET /reviews/summary
app.get("/reviews/summary", async (req, res) => {
  try {
    const [overall, distribution] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total_reviews,
                ROUND(AVG(rating), 2)::float AS average_rating
           FROM reviews`,
      ),
      pool.query(
        `SELECT g.rating, COUNT(r.id)::int AS total
           FROM generate_series(1, 5) AS g(rating)
           LEFT JOIN reviews r ON r.rating = g.rating
          GROUP BY g.rating
          ORDER BY g.rating DESC`,
      ),
    ]);

    res.json({
      status: "ok",
      db: "connected",
      ...overall.rows[0],
      distribution: distribution.rows,
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// Avaliações de um prestador, com nome do cliente. GET /reviews/provider/1
app.get("/reviews/provider/:id", async (req, res) => {
  if (!/^\d{1,9}$/.test(req.params.id)) {
    res.status(400).json({ status: "error", message: '"id" deve ser um inteiro positivo' });
    return;
  }
  const id = Number(req.params.id);

  try {
    const provider = await pool.query(
      "SELECT id, name, specialty FROM providers WHERE id = $1",
      [id],
    );
    if (provider.rowCount === 0) {
      res.status(404).json({ status: "error", message: "Prestador não encontrado" });
      return;
    }

    const reviews = await pool.query(
      `SELECT r.id, r.call_id, r.rating, r.comment,
              cu.name AS customer_name, c.finished_at
         FROM reviews r
         JOIN calls c      ON c.id  = r.call_id
         JOIN customers cu ON cu.id = c.customer_id
        WHERE r.provider_id = $1
        ORDER BY c.finished_at DESC`,
      [id],
    );

    res.json({
      status: "ok",
      db: "connected",
      provider: provider.rows[0],
      data: reviews.rows,
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

export default app;