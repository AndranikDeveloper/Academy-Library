import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { Tab, TabList, TabPanel, Tabs } from '../../shared/ui/Tabs';
import { PageHeader } from '../../widgets/page-header';
import styles from './LearningPage.module.css';

export function LearningPage() {
  const navigate = useNavigate();
  const browseAction = <Button onClick={() => navigate('/library')}>Browse the library</Button>;

  return (
    <div>
      <PageHeader title="My Learning" description="Courses and lesson series you're following." />

      <Tabs defaultValue="in-progress">
        <TabList>
          <Tab value="in-progress">In progress</Tab>
          <Tab value="completed">Completed</Tab>
        </TabList>
        <TabPanel value="in-progress">
          <div className={styles.panel}>
            <EmptyState
              icon={<GraduationCap aria-hidden="true" />}
              title="No courses in progress"
              description="Start a course from the library and your progress will show up here."
              action={browseAction}
            />
          </div>
        </TabPanel>
        <TabPanel value="completed">
          <div className={styles.panel}>
            <EmptyState
              icon={<GraduationCap aria-hidden="true" />}
              title="No completed courses yet"
              description="Courses you finish will be listed here for reference."
              action={browseAction}
            />
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}
