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
  const { category, ...fields } = data;

  if (!category) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing category' }) };
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    // Build dynamic INSERT query
    // Whitelist allowed categories/tables to prevent SQL injection and typos
    const allowedTables = ['laptops', 'monitors', 'printers', 'cameras', 'wifi'];
    if (!allowedTables.includes(category)) {
      await client.end();
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid category' }) };
    }

    const columns = Object.keys(fields);
    const values = Object.values(fields);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    // Quote identifiers to handle column names with spaces or uppercase letters
    const quotedColumns = columns.map(col => `"${col.replace(/"/g, '""')}"`);

    const query = `INSERT INTO "${category.replace(/"/g, '""')}" (${quotedColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *;`;

    // Execute query
    const result = await client.query(query, values);
    await client.end();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, inserted: result.rows[0] }),
    };
  } catch (error) {
    console.error("Error inserting asset:", error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
}
