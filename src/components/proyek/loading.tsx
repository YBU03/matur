import Image from "next/image";
import styles from "./loading.module.css";

export function ProyekLoading({ label = "Sedang menyiapkan data proyek…", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`${styles.loading} ${compact ? styles.compact : styles.panel}`}>
      <div aria-hidden="true" className={styles.track}>
        <div className={styles.traveller}>
          <Image src="/mascot/login/matur-welcome.webp" alt="" width={72} height={72} className={styles.mascot} />
          <span className={styles.segment} />
        </div>
      </div>
      <p className="font-semibold text-kopi-900">{label}</p>
      <p className="mt-1 text-xs text-stone-500">Mohon tunggu sebentar yaa</p>
    </div>
  );
}
