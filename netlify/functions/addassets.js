import { Client } from "pg";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const data = JSON.parse(event.body || "{}");
  const { category, ...fields } = data;

  if (!category) {
    return { statusCode: 400, body: "Missing category" };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Build dynamic INSERT query
    const columns = Object.keys(fields);
    const values = Object.values(fields);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    const query = `
      INSERT INTO ${category} (${columns.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING *;
    `;

    const result = await client.query(query, values);
    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, inserted: result.rows[0] }),
    };
  } catch (error) {
    console.error("Error inserting asset:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
