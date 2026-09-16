async function run() {
  console.log("Fetching workspace leads...");
  const res0 = await fetch("https://diginest-lead-engine.vercel.app/api/workspace", {
    headers: { "Authorization": "Bearer DIGINES3456F965FGJUD_TGIiju" }
  });
  const data = await res0.json();
  const leads = data.leads;
  
  const qualified = leads.filter(l => l.qualificationStatus === 'QUALIFIED' || l.manualDecision === 'QUALIFY');
  
  // Take top 5 qualified leads by score
  const targets = qualified
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, 5);
  
  console.log(`Generating previews for ${targets.length} leads:`);
  
  for (const lead of targets) {
    console.log(`\n- ${lead.name} (${lead.leadId})`);
    try {
      const res = await fetch("https://diginest-lead-engine.vercel.app/api/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer DIGINES3456F965FGJUD_TGIiju"
        },
        body: JSON.stringify({ action: "generate", leadId: lead.leadId })
      });
      const json = await res.json();
      console.log(`  generate => ${json.record ? 'Success' : 'Error'}`, json.error ? json.error : '');
      
      if (json.record && json.record.id) {
        const res2 = await fetch("https://diginest-lead-engine.vercel.app/api/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer DIGINES3456F965FGJUD_TGIiju"
          },
          body: JSON.stringify({ action: "status", previewId: json.record.id, status: "READY" })
        });
        const json2 = await res2.json();
        console.log(`  mark READY => ${json2.updated ? 'Success' : 'Error'}`);
        console.log(`  URL: https://diginest-lead-engine.vercel.app${json.record.slug}`);
      }
    } catch (e) {
      console.error("  error:", e);
    }
  }
}

run();
