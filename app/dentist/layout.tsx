import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dental Preview",
  robots: { index: false, follow: false },
};

export default function DentistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff !important; }
      `}</style>
      {children}
    </>
  );
}
