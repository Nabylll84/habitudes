import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get('code');
    const err = q.get('error_description') || q.get('error');

    async function run() {
      if (err) {
        navigate('/auth?error=' + encodeURIComponent(err), { replace: true });
        return;
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          navigate('/auth?error=' + encodeURIComponent(error.message), { replace: true });
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      navigate(data.session ? '/' : '/auth', { replace: true });
    }
    run();
  }, [navigate]);

  return (
    <div className="splash">
      <div className="splash-logo">⚡</div>
    </div>
  );
}