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

    // Normalize incoming column names to snake_case to match typical DB schemas
    const normalize = (col) => {
      return col
        .toString()
        .trim()
        .replace(/[^0-9a-zA-Z_]+/g, '_')
        .replace(/__+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase();
    };

    // Get actual columns for the target table from information_schema
    const tableColsRes = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [category]
    );
    const tableCols = new Set(tableColsRes.rows.map(r => r.column_name));

    // Map incoming columns to normalized db column names
    const mappedColumns = columns.map(col => ({ original: col, db: normalize(col) }));

    // Check for missing columns in the DB
    const missing = mappedColumns.filter(m => !tableCols.has(m.db));
    if (missing.length > 0) {
      await client.end();
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing columns in target table',
          details: missing.map(m => ({ provided: m.original, expected_column: m.db }))
        })
      };
    }

    // Use the normalized db column names in the INSERT
    const dbColumnNames = mappedColumns.map(m => `"${m.db.replace(/"/g, '""')}"`);
    const query = `INSERT INTO "${category.replace(/"/g, '""')}" (${dbColumnNames.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *;`;

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
