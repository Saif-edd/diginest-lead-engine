const https = require('https');
https.get('https://diginest-lead-engine.vercel.app/api/diag/lead-20260915-0012', res => {
  let chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => console.log(Buffer.concat(chunks).toString()));
});
