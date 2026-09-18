import Link from "next/link";
import { SITE_NAME, SITE_SUBTITLE } from "@/lib/config";

export function BrandHeader() {
  return (
    <header className="brand-bar">
      <div className="shell brand-inner">
        <div>
          <Link href="/QeA" style={{ textDecoration: "none" }}>
            <p className="brand-name">{SITE_NAME}</p>
          </Link>
          <p className="brand-subtitle">{SITE_SUBTITLE}</p>
        </div>
        <p className="brand-context">Domande dal pubblico</p>
      </div>
    </header>
  );
}
