import { useNavigate } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { Button } from '../../shared/ui/Button';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PageHeader } from '../../widgets/page-header';

export function CollectionsPage() {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Collections"
        description="Group resources together — for a course, a reading list, or a topic you're exploring."
      />
      <EmptyState
        icon={<Layers aria-hidden="true" />}
        title="You haven't created any collections yet"
        description="Collections let you organize saved resources into named groups. Start by browsing the library."
        action={<Button onClick={() => navigate('/library')}>Browse the library</Button>}
      />
    </div>
  );
}
