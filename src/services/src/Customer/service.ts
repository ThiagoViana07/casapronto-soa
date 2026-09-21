import express, { Application } from "express";
import pg from "pg";

const app: Application = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const pool = new pg.Pool({
  host: "casapronto-postgres",
  user: "casapronto",
  password: "casapronto123",
  database: "casapronto",
  port: 5432,
});

app.get("/customer", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT id, name, phone, address FROM customers ORDER BY id",
    );
    client.release();
    res.json({ status: "ok", db: "connected", data: result.rows });
  } catch (err) {
    console.error("Database connection error:", err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

app.get("/customer/search", async (req, res) => {
  const { name } = req.query;

  if (typeof name !== "string" || name.trim() === "" || name.length > 100) {
    res.status(400).json({
      status: "error",
      message: 'Query param "name" é obrigatório (1 a 100 caracteres)',
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT id, name, phone, address
         FROM customers
        WHERE name ILIKE '%' || $1 || '%'
        ORDER BY name
        LIMIT 20`,
      [name.trim()],
    );
    res.json({ status: "ok", db: "connected", data: result.rows });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

app.get("/customer/:id/calls", async (req, res) => {
  if (!/^\d{1,9}$/.test(req.params.id)) {
    res
      .status(400)
      .json({ status: "error", message: '"id" deve ser um inteiro positivo' });
    return;
  }
  const id = Number(req.params.id);

  try {
    const customer = await pool.query(
      "SELECT id, name FROM customers WHERE id = $1",
      [id],
    );
    if (customer.rowCount === 0) {
      res
        .status(404)
        .json({ status: "error", message: "Cliente não encontrado" });
      return;
    }

    const calls = await pool.query(
      `SELECT c.id, c.specialty, c.status, c.created_at, c.finished_at,
              p.name AS provider_name, r.rating, r.comment
         FROM calls c
         JOIN providers p ON p.id = c.provider_id
         LEFT JOIN reviews r ON r.call_id = c.id
        WHERE c.customer_id = $1
        ORDER BY c.created_at DESC`,
      [id],
    );

    res.json({
      status: "ok",
      db: "connected",
      customer: customer.rows[0],
      data: calls.rows,
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
