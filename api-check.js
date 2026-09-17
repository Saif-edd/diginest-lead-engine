const https = require('https');

const leadsToInspect = [
  'Vision Dental',
  'ICDE',
  'Harley Street',
  'Paramount Clinics',
  'The Smile Collective',
  'Al Razi'
];

async function fetchApi(endpoint) {
  return new Promise((resolve, reject) => {
    const req = https.get('https://diginest-lead-engine.vercel.app/api/' + endpoint, {
      headers: { 'Authorization': 'Bearer ' + process.env.DIGINEST_ADMIN_TOKEN }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
  });
}

async function run() {
  const previewsData = await fetchApi('preview');
  // the api/preview endpoint returns { previews: [...] } but wait, what does it return?
  console.log(Object.keys(previewsData));
}

run().catch(console.error);
