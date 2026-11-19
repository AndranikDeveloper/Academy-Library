import { useNavigate } from 'react-router-dom';
import { BookCopy, Bookmark, GraduationCap, Layers, Sparkles } from 'lucide-react';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { StatCard } from '../../shared/ui/StatCard';
import { PageHeader } from '../../widgets/page-header';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="An overview of your learning activity and saved resources."
      />

      <div className={styles.stats}>
        <StatCard
          icon={<Bookmark aria-hidden="true" />}
          label="Saved resources"
          caption="No data yet"
        />
        <StatCard
          icon={<BookCopy aria-hidden="true" />}
          label="Active loans"
          caption="No data yet"
        />
        <StatCard icon={<Layers aria-hidden="true" />} label="Collections" caption="No data yet" />
        <StatCard
          icon={<GraduationCap aria-hidden="true" />}
          label="Courses in progress"
          caption="No data yet"
        />
      </div>

      <div className={styles.activity}>
        <EmptyState
          icon={<Sparkles aria-hidden="true" />}
          title="Your activity will show up here"
          description="Once you start saving resources, borrowing books, or following a course, you'll see a summary of it on this dashboard."
          action={<Button onClick={() => navigate('/library')}>Explore the library</Button>}
        />
      </div>
    </div>
  );
}
