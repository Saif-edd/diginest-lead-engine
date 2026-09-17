import { findProductionLead } from './lib/persistence/db';
async function test() {
  const lead = await findProductionLead('lead-20260915-0012');
  if(!lead) { console.log('not found'); return; }
  console.log('ID:', lead.leadId);
  console.log('qualificationStatus:', lead.qualificationStatus);
  console.log('manualDecision:', lead.manualDecision);
  console.log('qualificationDecisionSource:', lead.qualificationDecisionSource);
  console.log('objective audit status:', lead.audit?.status);
  console.log('qualitative status:', lead.audit?.qualitativeStatus);
  process.exit(0);
}
test();
