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
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing required fields: asset_type, asset_id, employee_id are required' }) };
  }

  // Whitelist allowed asset tables to avoid SQL injection via table name
  const allowedTables = ['laptops','monitors','printers','cameras','wifi'];
  if (!allowedTables.includes(asset_type)) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: `Invalid asset_type. Allowed: ${allowedTables.join(', ')}` }) };
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

    // Update asset status in its category table. Use parameterized query for the value.
    // Note: asset_id must be the correct type for the table's id column (e.g., integer).
    try {
      await client.query(
        `UPDATE ${asset_type} SET status = 'Assigned' WHERE id = $1`,
        [asset_id]
      );
    } catch (updateErr) {
        if (updateErr && updateErr.message && updateErr.message.includes('invalid input syntax for type integer')) {
          // Attempt to find the row by other likely identifier columns (best-effort).
          try {
            const colsRes = await client.query(
              `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
              [asset_type]
            );

            const cols = colsRes.rows.map(r => r.column_name);

            // Candidate identifier names (normalized)
            const candidates = [
              'ip','ipaddress','ip_address','device_name','devicename','device name',
              'assets_tag','assets tag','assetstag','asset_tag','assetscode','assets_code','assets code',
              'assets tag/no','assets_tag_no','assets_tag_no','assets_tag_no'
            ];

            function normalize(name) {
              return (name || '').toString().toLowerCase().replace(/[^a-z0-9]/g,'');
            }

            const colMap = {};
            cols.forEach(c => { colMap[normalize(c)] = c; });

            let foundRow = null;
            let foundCol = null;

            for (const cand of candidates) {
              const n = normalize(cand);
              if (colMap[n]) {
                const actualCol = colMap[n];
                // Try to find the row by this column
                const sel = await client.query(
                  `SELECT id FROM ${asset_type} WHERE "${actualCol}" = $1 LIMIT 1`,
                  [asset_id]
                );
                if (sel && sel.rowCount > 0) {
                  foundRow = sel.rows[0];
                  foundCol = actualCol;
                  break;
                }
              }
            }

            if (foundRow) {
              const numericId = foundRow.id;
              // Use numericId for assignment insert and update
              await client.query(
                "INSERT INTO assignments (asset_type, asset_id, employee_id) VALUES ($1, $2, $3)",
                [asset_type, numericId, employee_id]
              );
              await client.query(
                `UPDATE ${asset_type} SET status = 'Assigned' WHERE id = $1`,
                [numericId]
              );

              return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, note: `Mapped provided id using column ${foundCol}` })
              };
            }
          } catch (mapErr) {
            console.error('Mapping attempt failed', mapErr);
          }

          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'asset_id appears to be a non-numeric value but the DB `id` column is integer. Could not map external id to a DB row automatically. Consider using the numeric DB id or add a stable external identifier column.' })
          };
        }
        throw updateErr;
    }

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
