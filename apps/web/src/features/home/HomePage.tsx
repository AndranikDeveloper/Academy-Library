import { Library } from 'lucide-react';
import styles from './HomePage.module.css';

export function HomePage() {
  return (
    <section className={styles.container}>
      <Library className={styles.icon} aria-hidden="true" />
      <h1 className={styles.title}>Academy Library</h1>
      <p className={styles.subtitle}>
        The platform foundation is up and running. Resource search, tagging, and course management
        land in upcoming tasks.
      </p>
    </section>
  );
}
