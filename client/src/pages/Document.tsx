import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { ErrorBox, LogoMark, PageSkeleton } from '../components/ui';
import { useTitle } from '../lib/hooks';

export function DocumentPage() {
  const { id } = useParams();
  const q = useQuery<any>({ queryKey: ['doc', id], queryFn: () => api(`/requests/${id}/document`) });
  useTitle('Справка');
  if (q.isLoading) return <div className="page"><PageSkeleton /></div>;
  if (q.error) return <div className="page"><ErrorBox error={q.error} /><Link to={`/requests/${id}`} className="link" style={{ marginTop: 14 }}>Назад к заявке</Link></div>;
  const d = q.data;
  const p = d.profile;
  const issued = new Date(d.issuedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="doc-page">
      <div className="doc-bar no-print">
        <Link to={`/requests/${id}`} className="btn btn-ghost btn-sm"><ArrowLeft size={15} /> К заявке</Link>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={15} /> Печать / PDF</button>
      </div>
      <article className="paper">
        <div className="paper-watermark" aria-hidden="true">ОБРАЗЕЦ · КОНЦЕПТ</div>
        <header className="paper-head">
          <LogoMark size={44} />
          <div>
            <b>Университет «Стеллар»</b>
            <span>вымышленная образовательная организация · учебный концепт</span>
          </div>
        </header>
        <h1>{d.title.toUpperCase()}</h1>
        <div className="paper-no">№ {d.number} от {issued}</div>
        <p>
          Настоящим подтверждается, что <b>{p.lastName} {p.firstName} {p.middleName}</b>{p.birthDate ? ` (${new Date(p.birthDate).toLocaleDateString('ru-RU')} г. р.)` : ''} действительно обучается
          в Университете «Стеллар» на {p.course} курсе по {p.studyForm.toLowerCase().replace(/ая$/, 'ой')} форме обучения ({p.funding.toLowerCase()}),
          {' '}{p.faculty.toLowerCase()}, направление подготовки {p.programCode} «{p.program}», группа {p.group}.
        </p>
        <p>Зачётная книжка № {p.recordBook}. Нормативный срок окончания обучения — 30 июня {p.enrolledYear + 4} г.</p>
        {d.payload?.place && <p>Справка выдана для предъявления по месту требования: {String(d.payload.place).toLowerCase()}.</p>}
        <footer className="paper-foot">
          <div>
            <div>Специалист деканата</div>
            <div className="sig">Лаврова О. С.</div>
            <small>Документ подписан простой электронной подписью кабинета</small>
          </div>
          <div className="qr">
            <img src={d.qr} alt="QR-код для проверки подлинности" width={120} height={120} />
            <small>Проверка: {d.verifyUrl.replace(/^https?:\/\//, '')}</small>
          </div>
        </footer>
        <div className="paper-concept">Концепт для конкурса «Цифровой деканат будущего». Документ не имеет юридической силы, данные вымышлены.</div>
      </article>
    </div>
  );
}
