import Link from "next/link";

/**
 * Site footer. Data-source attribution belongs here because every page that
 * renders ERA5 numbers or advisory levels has to link back to the source —
 * keeping it in the footer means we don't have to scatter attribution
 * paragraphs across every component.
 */
export function PageFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col justify-between gap-3 px-6 py-8 text-[12px] text-text-muted md:flex-row md:px-12">
        <div>© 2026 Where to Go for Great Weather</div>
        <div className="flex flex-wrap gap-5">
          <span>Data: ECMWF ERA5 · ReliefWeb</span>
          <Link href="/privacy" className="hover:text-text">Privacy</Link>
          <Link href="/terms" className="hover:text-text">Terms</Link>
          <Link href="/contact" className="hover:text-text">Contact</Link>
        </div>
      </div>
    </footer>
  );
}
