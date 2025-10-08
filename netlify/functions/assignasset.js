import { Client } from "pg";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const data = JSON.parse(event.body || "{}");
  const { asset_type, asset_id, employee_id } = data;

  if (!asset_type || !asset_id || !employee_id) {
    return { statusCode: 400, body: "Missing required fields" };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Create assignment record
    await client.query(
      "INSERT INTO assignments (asset_type, asset_id, employee_id) VALUES ($1, $2, $3)",
      [asset_type, asset_id, employee_id]
    );

    // Update asset status and user_name in its category table
    await client.query(
      `UPDATE ${asset_type} SET status = 'Assigned' WHERE id = $1`,
      [asset_id]
    );

    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Error assigning asset:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
