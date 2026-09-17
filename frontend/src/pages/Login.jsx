import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthShell, Field, FormError, SubmitButton } from '../components/pulse/AuthShell';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        // Read straight from the form so browser autofill (which doesn't fire
        // React onChange) is always captured.
        const fd = new FormData(e.currentTarget);
        const email = (fd.get('email') || '').toString().trim();
        const password = (fd.get('password') || '').toString();
        if (!email || !password) {
            setError('Enter your email and password.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await login({ email, password });
            navigate(location.state?.from || '/documents', { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <AuthShell title="Welcome back." subtitle="Sign in to reach your documents, chats and saved results.">
            <form className="a-form p-form" onSubmit={handleSubmit} noValidate>
                <FormError message={error} />
                <Field label="Email" id="login-email" type="email" name="email" required autoComplete="email" />
                <Field label="Password" id="login-password" type="password" name="password" required autoComplete="current-password" />
                <SubmitButton busy={busy}>Sign in <i className="fa-solid fa-arrow-right" aria-hidden="true" /></SubmitButton>
            </form>
            <p className="a-foot">
                No account? <Link to="/register" className="p-link">Create one</Link>
            </p>
        </AuthShell>
    );
}
