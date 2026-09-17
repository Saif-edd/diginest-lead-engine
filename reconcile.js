const adminToken = "825a86b3cca0f83c608e9a470f4513697ddbebcc494862da3e0006015bbe4c27";

async function reconcile() {
  const leads = [
    "lead-20260915-0001", // Vision
    "lead-20260915-0002", // ICDE
    "lead-20260915-0003", // Harley
    "lead-20260915-0004", // Paramount
    "lead-20260915-0005", // Smile Collective
    "lead-20260915-0006"  // Al Razi
  ];
  
  const headers = {
    "Authorization": "Bearer " + adminToken,
    "Content-Type": "application/json"
  };

  // 1. Get all leads and previews
  const outreachRes = await fetch("https://diginest-lead-engine.vercel.app/api/outreach", { headers });
  const previewRes = await fetch("https://diginest-lead-engine.vercel.app/api/preview", { headers });
  const leadRes = await fetch("https://diginest-lead-engine.vercel.app/api/leads", { headers });
  
  const outreachData = await outreachRes.json();
  const previewData = await previewRes.json();
  const leadData = await leadRes.json();
  
  const outreachMap = {};
  outreachData.records.forEach(r => outreachMap[r.leadId] = r);
  
  const previewMap = {};
  previewData.records.forEach(r => previewMap[r.leadId] = r);
  
  const leadMap = {};
  leadData.leads.forEach(r => leadMap[r.id] = r);
  
  for (const leadId of leads) {
    const lead = leadMap[leadId];
    const preview = previewMap[leadId];
    const record = outreachMap[leadId];
    
    if (!lead || !record) {
      console.log("Missing data for", leadId);
      continue;
    }
    
    // recommendOutreachChannel logic mapped here:
    let channel = "NONE";
    if (preview?.verifiedFacts?.whatsapp) {
      channel = "WHATSAPP";
    } else if (lead.email) {
      channel = "EMAIL";
    } else {
      let igUrl = null;
      if (lead.socialUrl && lead.socialUrl.toLowerCase().includes("instagram.com")) {
        igUrl = lead.socialUrl;
      } else if (preview?.verifiedFacts?.verifiedSocialProfiles) {
        igUrl = preview.verifiedFacts.verifiedSocialProfiles.find(p => p.toLowerCase().includes("instagram.com"));
      }
      if (igUrl) {
        channel = "INSTAGRAM";
      }
    }
    
    console.log("Reconciling", leadId, "from", record.channel, "to", channel);
    
    const updateRes = await fetch("https://diginest-lead-engine.vercel.app/api/outreach/" + leadId, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "update_channel", channel })
    });
    const updateData = await updateRes.json();
    console.log("Done", leadId, updateRes.status);
  }
}
reconcile().catch(console.error);
