import { useNavigate } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PageHeader } from '../../widgets/page-header';

export function SavedPage() {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Saved Resources"
        description="Resources you've bookmarked for later, all in one place."
      />
      <EmptyState
        icon={<Bookmark aria-hidden="true" />}
        title="No saved resources yet"
        description="When you save a book, article, or video from the library, it will show up here."
        action={<Button onClick={() => navigate('/library')}>Browse the library</Button>}
      />
    </div>
  );
}
