import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui';
import { CalendarIcon, FireIcon, UsersIcon, BoltIcon, CheckCircleIcon } from '@/lib/icons';

const FEATURES = [
  { icon: <CalendarIcon size={22} />, title: 'Suivi quotidien', text: 'Coche tes habitudes chaque jour, en une minute.' },
  { icon: <FireIcon size={22} />, title: 'Séries et streaks', text: 'Enchaîne les jours et ne casse jamais la flamme.' },
  { icon: <UsersIcon size={22} />, title: 'Entre amis', text: 'Suivez vos progrès, comparez-vous, motivez-vous.' },
  { icon: <BoltIcon size={22} />, title: 'Temps réel', text: 'Tes coches et celles de tes amis, à l’instant.' },
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-brand">
          <Logo size={36} />
          <span>HabitFlow</span>
        </div>
        <Link className="btn btn-ghost" to="/auth">Se connecter</Link>
      </header>

      <main className="landing-hero">
        <p className="eyebrow">Simple. Rituel. Efficace.</p>
        <h1>Tes habitudes,<br />ta meilleure version.</h1>
        <p className="landing-sub">
          Suis tes routines, enchaîne les streaks et progresse avec tes amis — sans prise de tête.
        </p>
        <div className="landing-cta">
          <Link className="btn btn-primary btn-lg" to="/auth">Commencer gratuitement</Link>
          <Link className="btn btn-lg btn-ghost" to="/auth">Créer un compte</Link>
        </div>
        <ul className="landing-ticks">
          <li><CheckCircleIcon size={15} /> Gratuit, sans pub</li>
          <li>1 minute par jour</li>
          <li>Avec tes amis</li>
        </ul>
      </main>

      <section className="landing-features">
        {FEATURES.map((f) => (
          <div className="lf-card" key={f.title}>
            <div className="lf-icon">{f.icon}</div>
            <strong>{f.title}</strong>
            <p>{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}