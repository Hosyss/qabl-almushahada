import Link from "next/link";

import { PUBLIC_POLICY_NAV } from "@/lib/public-policy-pages";

import styles from "./policy-links.module.css";

export function PolicyLinks() {
  return (
    <nav className={styles.bar} aria-label="روابط الشفافية والسياسات">
      <span>الشفافية</span>
      <div>
        {PUBLIC_POLICY_NAV.map((item) => (
          <Link href={item.href} key={item.href}>{item.label}</Link>
        ))}
      </div>
    </nav>
  );
}
