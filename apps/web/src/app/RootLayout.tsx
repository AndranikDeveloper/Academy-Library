import { Outlet } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { ThemeToggle } from './theme/ThemeToggle';
import styles from './RootLayout.module.css';

export function RootLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <BookOpen className={styles.logo} aria-hidden="true" />
          <span className={styles.wordmark}>Academy Library</span>
        </div>
        <ThemeToggle />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
