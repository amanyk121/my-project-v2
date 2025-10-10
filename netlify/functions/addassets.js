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

    // Header mapping: common human-friendly headers -> candidate DB column names
    const headerMapping = {
      'ip': ['ip', 'ip_address', 'ipaddr', 'ipaddress'],
      'company name': ['company_name', 'company', 'companyname'],
      'no. of cctv': ['no_of_cctv', 'no_of_cameras', 'cctv_count'],
      'no. of cctv(s)': ['no_of_cctv', 'no_of_cameras', 'cctv_count'],
      'assets tag/no.': ['assets_tag_no', 'assets_tag', 'assets_tag_no'],
      'assets tag': ['assets_tag', 'assets_tag_no'],
      'device name': ['device_name', 'device'],
      'serial no.': ['serial_no', 'serial_number', 'serial'],
      'serial no': ['serial_no', 'serial_number', 'serial'],
      'make': ['make', 'manufacturer'],
      'model': ['model'],
      'location': ['location', 'site', 'location_name'],
      'user name': ['user_name', 'username', 'user'],
      'users': ['user_name', 'username', 'users']
    };

    // Map incoming columns to actual DB columns (try mapping candidates, then normalized)
    const mappedColumns = columns.map(col => {
      const original = col;
      const key = col.toString().trim().toLowerCase();

      const candidates = headerMapping[key] ? headerMapping[key].slice() : [];
      // always try the normalized form as a candidate last
      candidates.push(normalize(col));

      // Find first candidate that exists in tableCols
      const found = candidates.find(c => tableCols.has(c));
      return { original, db: found || normalize(col), tried: candidates };
    });

    // Check for missing columns in the DB (those that we couldn't map)
    const missing = mappedColumns.filter(m => !tableCols.has(m.db));
    if (missing.length > 0) {
      await client.end();
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing columns in target table',
          details: missing.map(m => ({ provided: m.original, expected_column: m.db, tried: m.tried }))
        })
      };
    }

    // Use the resolved db column names in the INSERT
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
