import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthShell, Field, FormError, SubmitButton } from '../components/pulse/AuthShell';

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        // Read from the form directly so browser autofill is captured.
        const fd = new FormData(e.currentTarget);
        const displayName = (fd.get('displayName') || '').toString().trim();
        const email = (fd.get('email') || '').toString().trim();
        const password = (fd.get('password') || '').toString();

        if (!displayName || !email) {
            setError('Fill in your name and email.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await register({ email, displayName, password });
            navigate('/documents', { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <AuthShell
            title="Make an account."
            subtitle="Upload documents and ask them questions in a couple of minutes."
            aside="Every answer cites the page it came from, so you can check it yourself."
        >
            <form className="a-form p-form" onSubmit={handleSubmit} noValidate>
                <FormError message={error} />
                <Field label="Name" id="reg-name" type="text" name="displayName" required maxLength={120} autoComplete="name" />
                <Field label="Email" id="reg-email" type="email" name="email" required autoComplete="email" />
                <Field
                    label="Password" id="reg-password" type="password" name="password"
                    required minLength={8} autoComplete="new-password" hint="At least 8 characters."
                />
                <SubmitButton busy={busy}>Create account <i className="fa-solid fa-arrow-right" aria-hidden="true" /></SubmitButton>
                <p className="p-hint">
                    By creating an account you agree to the <Link to="/terms" className="p-link">Terms</Link> and{' '}
                    <Link to="/privacy" className="p-link">Privacy Policy</Link>.
                </p>
            </form>
            <p className="a-foot">
                Already registered? <Link to="/login" className="p-link">Sign in</Link>
            </p>
        </AuthShell>
    );
}
