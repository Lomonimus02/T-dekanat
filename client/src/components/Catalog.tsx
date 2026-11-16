import { Link } from 'react-router-dom';
import { ChevronRight, FileBadge, FileSignature, MessageSquareText, Zap } from 'lucide-react';
import { REQUEST_TYPES } from '../../../shared/requests';

const GROUPS = [
  { id: 'cert', title: 'Справки', icon: <FileBadge size={16} /> },
  { id: 'statement', title: 'Заявления', icon: <FileSignature size={16} /> },
  { id: 'contact', title: 'Связь с деканатом', icon: <MessageSquareText size={16} /> },
] as const;

export function Catalog(_: { compact?: boolean }) {
  return (
    <div className="catalog">
      {GROUPS.map((g) => (
        <section key={g.id} className="panel list-card">
          <h2 className="cat-h">{g.icon}{g.title}</h2>
          {REQUEST_TYPES.filter((t) => t.group === g.id).map((t) => (
            <Link key={t.id} to={`/requests/new/${t.id}`} className="cat-row">
              <span className="rq-main">
                <b>{t.title}</b>
                <span className="faint ellipsis">{t.short}</span>
              </span>
              <span className="cat-eta">{t.electronic && <Zap size={12} />}{t.eta}</span>
              <ChevronRight size={18} className="faint" style={{ flex: 'none' }} />
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
