import { Client } from "pg";

export async function handler() {
  // Early environment validation to provide clearer errors in function logs
  const dbUrl = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || process.env.NETLIFY_DATABASE_URL_UNPOOLED || '';
  if (!dbUrl) {
    console.error('Missing DATABASE_URL environment variable');
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing DATABASE_URL. Configure DATABASE_URL in Netlify site environment variables.' }) };
  }
  if (dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost')) {
    console.error('DATABASE_URL appears to point to localhost which will not be reachable from Netlify functions');
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'DATABASE_URL points to localhost (127.0.0.1). Use your remote Neon DB connection string in Netlify environment variables.' }) };
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Fetch all asset categories
    const laptops = await client.query("SELECT * FROM laptops ORDER BY id DESC");
    const monitors = await client.query("SELECT * FROM monitors ORDER BY id DESC");
    const printers = await client.query("SELECT * FROM printers ORDER BY id DESC");
    const cameras = await client.query("SELECT * FROM cameras ORDER BY id DESC");
    const wifi = await client.query("SELECT * FROM wifi ORDER BY id DESC");

    await client.end();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        laptops: laptops.rows,
        monitors: monitors.rows,
        printers: printers.rows,
        cameras: cameras.rows,
        wifi: wifi.rows,
      }),
    };
  } catch (error) {
    console.error("Error fetching assets:", error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
}
