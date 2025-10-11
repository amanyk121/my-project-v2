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
  let { asset_type, asset_id, employee_id } = data;

  // Basic validation & normalization
  asset_type = asset_type && String(asset_type).trim();
  asset_id = asset_id !== undefined && asset_id !== null ? String(asset_id).trim() : '';
  employee_id = employee_id !== undefined && employee_id !== null ? String(employee_id).trim() : '';

  if (!asset_type || !asset_id || !employee_id) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: 'Missing required fields: asset_type, asset_id, employee_id are required' }) };
  }

  // Size limits to avoid overly large inputs
  if (asset_id.length > 200 || employee_id.length > 200) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: 'Input values too long' }) };
  }

  // Whitelist allowed asset tables to avoid SQL injection via table name
  const allowedTables = ['laptops','monitors','printers','cameras','wifi'];
  if (!allowedTables.includes(asset_type)) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: false, error: `Invalid asset_type. Allowed: ${allowedTables.join(', ')}` }) };
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();


    // Resolve asset_id to numeric DB id when possible
    let resolvedNumericId = null;
    const warnings = [];
    const isNumericLike = /^[0-9]+$/.test(asset_id);

    if (isNumericLike) {
      resolvedNumericId = Number(asset_id);
      warnings.push({ action: 'resolved_numeric', provided: asset_id });
    } else {
      // First, try external_id column if present
      try {
        const extColRes = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'external_id' LIMIT 1`,
          [asset_type]
        );
        if (extColRes.rowCount > 0) {
          const quotedTable = `"${asset_type.replace(/"/g,'""')}"`;
          const sel = await client.query(
            `SELECT id FROM ${quotedTable} WHERE external_id = $1 LIMIT 1`,
            [asset_id]
          );
          if (sel && sel.rowCount > 0) { resolvedNumericId = sel.rows[0].id; warnings.push({ action: 'resolved_external_id', provided: asset_id }); }
        }
      } catch (extErr) {
        console.warn('external_id lookup failed', extErr);
      }

      // If still not found, try other candidate identifier columns (IP, device name, tags)
      if (resolvedNumericId === null) {
        try {
          const colsRes = await client.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
            [asset_type]
          );
          const cols = colsRes.rows.map(r => r.column_name);

          const candidates = [
            'external_id','ip','ipaddress','ip_address','device_name','devicename','assets_tag','assets_tag_no','assetstag','asset_tag'
          ];

          function normalize(name) { return (name||'').toString().toLowerCase().replace(/[^a-z0-9]/g,''); }
          const colMap = {};
          cols.forEach(c => { colMap[normalize(c)] = c; });

          const quotedTable = `"${asset_type.replace(/"/g,'""')}"`;
          for (const cand of candidates) {
            const n = normalize(cand);
            if (colMap[n]) {
              const actualCol = colMap[n];
              const sel = await client.query(
                `SELECT id FROM ${quotedTable} WHERE "${actualCol.replace(/"/g,'""')}" = $1 LIMIT 1`,
                [asset_id]
              );
              if (sel && sel.rowCount > 0) { resolvedNumericId = sel.rows[0].id; warnings.push({ action: 'resolved_by_candidate', column: actualCol, provided: asset_id }); break; }
            }
          }
        } catch (mapErr) {
          console.warn('Mapping attempt failed', mapErr);
        }
      }
    }
    if (resolvedNumericId === null) {
      await client.end();
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Could not resolve provided asset identifier to a DB row. Use numeric id or ensure external_id exists and matches.' })
      };
    }

    // Wrap assignment and update in a transaction
    const quotedTable = `"${asset_type.replace(/"/g,'""')}"`;
    try {
      await client.query('BEGIN');
      const insertRes = await client.query(
        'INSERT INTO assignments (asset_type, asset_id, employee_id) VALUES ($1, $2, $3) RETURNING *',
        [asset_type, resolvedNumericId, employee_id]
      );

      await client.query(
        `UPDATE ${quotedTable} SET status = 'Assigned' WHERE id = $1`,
        [resolvedNumericId]
      );

      await client.query('COMMIT');

      await client.end();

      const responseBody = { success: true, assignedId: resolvedNumericId, resolved_by: warnings.length ? warnings[warnings.length-1] : { action: 'numeric', provided: String(asset_id) } };
      if (warnings.length > 0) responseBody.warnings = warnings;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(responseBody),
      };
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch (rbErr) { console.warn('Rollback failed', rbErr); }
      await client.end();
      console.error('Transaction error assigning asset:', txErr);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Database transaction failed while assigning asset.' }),
      };
    }
  } catch (error) {
    console.error("Error assigning asset:", error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
}
