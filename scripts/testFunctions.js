import url from 'url';
import path from 'path';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const files = [
  'netlify/functions/getassets.js',
  'netlify/functions/getemployees.js',
  'netlify/functions/addassets.js',
  'netlify/functions/addemployee.js',
  'netlify/functions/assignasset.js'
];

async function run() {
  for (const f of files) {
    const modPath = 'file://' + path.join(process.cwd(), f);
    console.log('\n--- Invoking', f, '---');
    try {
      const mod = await import(modPath);
      if (!mod || typeof mod.handler !== 'function') {
        console.log('No handler exported in', f);
        continue;
      }

      let event;
      switch (path.basename(f)) {
        case 'getassets.js':
          event = { httpMethod: 'GET' };
          break;
        case 'getemployees.js':
          event = { httpMethod: 'GET' };
          break;
        case 'addassets.js':
          event = { httpMethod: 'POST', body: JSON.stringify({ category: 'laptops', data: { name: 'test' } }) };
          break;
        case 'addemployee.js':
          event = { httpMethod: 'POST', body: JSON.stringify({ name: 'Test User', department: 'QA', source: 'manual' }) };
          break;
        case 'assignasset.js':
          event = { httpMethod: 'POST', body: JSON.stringify({ asset_type: 'wifi', asset_id: 'abc123', employee_id: 'EMP1' }) };
          break;
        default:
          event = { httpMethod: 'GET' };
      }

      const result = await mod.handler(event);
      console.log('Result status:', result && result.statusCode);
      try {
        const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
        console.log('Body:', body);
      } catch (e) {
        console.log('Body (raw):', result.body);
      }
    } catch (err) {
      console.error('Error invoking', f, err && err.stack ? err.stack : err);
    }
  }
}

run().catch(err => { console.error(err); process.exit(1); });
