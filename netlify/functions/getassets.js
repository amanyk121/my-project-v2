import { Client } from "pg";

export async function handler() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
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
