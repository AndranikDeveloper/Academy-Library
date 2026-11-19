import { useNavigate } from 'react-router-dom';
import { BookCopy } from 'lucide-react';
import { Alert } from '../../shared/ui/Alert';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PageHeader } from '../../widgets/page-header';
import styles from './LoansPage.module.css';

export function LoansPage() {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Book Loans"
        description="Track physical books you've checked out from the library and when they're due back."
      />

      <Alert variant="info" className={styles.alert}>
        Book Loans tracks physical, not digital, borrowing — it will sync with the library's
        circulation desk once that integration exists.
      </Alert>

      <EmptyState
        icon={<BookCopy aria-hidden="true" />}
        title="No active loans"
        description="Books you check out in person will appear here, along with their due dates."
        action={<Button onClick={() => navigate('/library')}>Browse the library</Button>}
      />
    </div>
  );
}
