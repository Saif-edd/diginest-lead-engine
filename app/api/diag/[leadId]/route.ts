import { NextResponse } from 'next/server';
import { findProductionLead } from '@/lib/persistence/db';
export const runtime = 'nodejs';
export async function GET(req: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const lead = await findProductionLead(leadId);
  return NextResponse.json({ lead });
}
