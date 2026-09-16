import { findPreviewBySlug } from "@/lib/persistence/db";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DentalPreviewPage from "@/components/preview/DentalPreviewPage";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const fullSlug = `/dentist/${slug}`;
  const record = await findPreviewBySlug(fullSlug).catch(() => null);

  if (!record || record.status !== "READY") {
    return { title: "Preview | Diginest" };
  }

  const { business, hero } = record.configJson;
  return {
    title: `${business.name} – ${hero.headline}`,
    description: hero.subheadline,
    robots: { index: false, follow: false },
  };
}

export default async function DentistPreviewRoute({ params }: Props) {
  const { slug } = await params;
  const fullSlug = `/dentist/${slug}`;

  let record;
  try {
    record = await findPreviewBySlug(fullSlug);
  } catch {
    notFound();
  }

  if (!record || record.status !== "READY") {
    notFound();
  }

  const { configJson } = record;

  return <DentalPreviewPage config={configJson} />;
}
