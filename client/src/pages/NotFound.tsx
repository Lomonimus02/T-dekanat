import { Link } from 'react-router-dom';
import { Brand } from '../components/ui';
import { useTitle } from '../lib/hooks';

export function NotFound() {
  useTitle('Не найдено');
  return (
    <div className="verify">
      <div className="verify-card panel" style={{ textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 14 }}>
        <Brand />
        <div className="display" style={{ fontSize: 56, marginTop: 10 }}>404</div>
        <p className="muted">Такой страницы нет — возможно, ссылка устарела или в адресе опечатка.</p>
        <Link to="/" className="btn btn-primary">На главную</Link>
      </div>
    </div>
  );
}
