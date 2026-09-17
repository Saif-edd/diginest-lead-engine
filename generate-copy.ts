import { generateAllVariants } from './lib/outreach/messages';
const ctx = { businessName: 'Vision Dental Clinic', city: 'Abu Dhabi', country: null, currentWebsite: 'https://visiondentalclinic.com', mainProblem: 'outdated visual structure', rating: 4.9, reviewCount: 1070, finalPreviewUrl: 'https://diginest-lead-engine.vercel.app/dentist/vision-dental-clinic-abu-dhabi--abu-dhabi' };
console.log('=== WHATSAPP ===\n', JSON.stringify(generateAllVariants(ctx, 'WHATSAPP'), null, 2));
console.log('\n=== EMAIL ===\n', JSON.stringify(generateAllVariants(ctx, 'EMAIL'), null, 2));
