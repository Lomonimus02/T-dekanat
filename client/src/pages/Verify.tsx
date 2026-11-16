import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { api } from '../lib/api';
import { Brand, Skeleton } from '../components/ui';
import { useTitle } from '../lib/hooks';

export function VerifyPage() {
  const { code } = useParams();
  useTitle('Проверка документа');
  const q = useQuery<any>({ queryKey: ['verify', code], queryFn: () => api(`/verify/${code}`), retry: false });
  return (
    <div className="verify">
      <div className="verify-card panel">
        <Brand />
        <div className="label" style={{ marginTop: 22 }}>Проверка подлинности документа</div>
        {q.isLoading ? <Skeleton h={90} style={{ marginTop: 14 }} /> : q.data?.valid ? (
          <div className="verify-res ok">
            <ShieldCheck size={36} />
            <div>
              <div className="h2">Документ действителен</div>
              <p className="muted" style={{ marginTop: 6 }}>{q.data.title} № {q.data.number}<br />Выдана: {q.data.holder}<br />Дата: {new Date(q.data.issuedAt).toLocaleDateString('ru-RU')}</p>
            </div>
          </div>
        ) : (
          <div className="verify-res bad">
            <ShieldX size={36} />
            <div><div className="h2">Документ не найден</div><p className="muted" style={{ marginTop: 6 }}>Код не существует или справка отозвана.</p></div>
          </div>
        )}
        <p className="faint" style={{ fontSize: 12.5, marginTop: 20 }}>Показываем только факт выдачи и инициалы — без других персональных данных. Концепт для конкурса «Цифровой деканат будущего», не официальный сервис.</p>
      </div>
    </div>
  );
}
