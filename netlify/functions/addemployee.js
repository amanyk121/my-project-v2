import { Client } from "pg";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const data = JSON.parse(event.body || "{}");
  const { name, department, source } = data;

  if (!name) {
    return { statusCode: 400, body: "Missing name" };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(
      "INSERT INTO employees (name, department, source) VALUES ($1, $2, $3) RETURNING *",
      [name, department || null, source || "manual"]
    );
    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, inserted: result.rows[0] }),
    };
  } catch (error) {
    console.error("Error adding employee:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
