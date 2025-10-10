import { Client } from "pg";

export async function handler(event) {
  const dbUrl = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || process.env.NETLIFY_DATABASE_URL_UNPOOLED || '';
  if (!dbUrl) {
    console.error('Missing DATABASE_URL environment variable');
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing DATABASE_URL. Configure DATABASE_URL in Netlify site environment variables.' }) };
  }
  if (dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost')) {
    console.error('DATABASE_URL appears to point to localhost which will not be reachable from Netlify functions');
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'DATABASE_URL points to localhost (127.0.0.1). Use your remote Neon DB connection string in Netlify environment variables.' }) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const data = JSON.parse(event.body || "{}");
  const { asset_type, asset_id, employee_id } = data;

  if (!asset_type || !asset_id || !employee_id) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const client = new Client({
    connectionString: dbUrl,
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error("Error assigning asset:", error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
}
