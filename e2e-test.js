const https = require('https');
const token = '825a86b3cca0f83c608e9a470f4513697ddbebcc494862da3e0006015bbe4c27';

function fetchAPI(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request('https://diginest-lead-engine.vercel.app' + path, {
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { resolve(JSON.parse(text)); } catch(e) { resolve({ raw: text }); }
      });
    });
    if(data) req.write(data);
    req.end();
  });
}

(async () => {
  console.log('1. Starting state');
  let p = await fetchAPI('/api/preview');
  console.log('Vision preview exists?', !!p.records.find(r => r.leadId === 'lead-20260915-0012'));

  console.log('\n2. Generate Brief (should HEAL)');
  console.log(await fetchAPI('/api/preview', 'POST', { action: 'generate_brief', leadId: 'lead-20260915-0012' }));

  console.log('\n3. Generate Prompt');
  console.log(await fetchAPI('/api/preview', 'POST', { action: 'generate_prompt', leadId: 'lead-20260915-0012' }));

  console.log('\n4. Mark IN_V0');
  console.log(await fetchAPI('/api/preview', 'POST', { action: 'mark_in_v0', previewId: 'preview_lead-20260915-0012' }));

  console.log('\n5. Add URL');
  console.log(await fetchAPI('/api/preview', 'POST', { action: 'add_preview_url', previewId: 'preview_lead-20260915-0012', finalPreviewUrl: 'https://diginest-lead-engine.vercel.app/dentist/vision-dental-clinic-abu-dhabi--abu-dhabi' }));

  console.log('\n6. Mark Ready');
  console.log(await fetchAPI('/api/preview', 'POST', { action: 'mark_ready_for_outreach', previewId: 'preview_lead-20260915-0012' }));

  console.log('\n7. Init Outreach');
  console.log(await fetchAPI('/api/outreach/lead-20260915-0012', 'POST', { action: 'initialize' }));

  console.log('\n8. Check Outreach Generate (Copy V2)');
  console.log(await fetchAPI('/api/outreach/lead-20260915-0012'));
})();
