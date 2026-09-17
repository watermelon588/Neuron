import { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitFeedback } from '../../services/feedbackApi';
import { Brand } from './Brand';
import { LEGAL_LINKS } from './links';

const SOCIALS = [
    { id: 'github', label: 'GitHub', href: 'https://github.com/watermelon588', icon: 'fa-brands fa-github' },
    { id: 'x', label: 'X (Twitter)', href: 'https://x.com/turquoise_0904', icon: 'fa-brands fa-x-twitter' },
    { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/lilm.ocha', icon: 'fa-brands fa-instagram' },
    { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/maity-rohit', icon: 'fa-brands fa-linkedin-in' },
    // Discord handles aren't linkable, so copy it instead.
    { id: 'discord', label: 'Copy Discord handle toiletduck69', handle: 'toiletduck69', icon: 'fa-brands fa-discord' },
    { id: 'email', label: 'Email', href: 'mailto:maityrohit021@gmail.com', icon: 'fa-solid fa-envelope' },
];

const PRODUCT_LINKS = [
    { to: '/search', label: 'Search' },
    { to: '/documents', label: 'Documents' },
    { to: '/chat', label: 'Chat' },
    { to: '/profile', label: 'Profile' },
];

export default function PulseFooter() {
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // idle | sending | sent | error
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(null);

    const copyHandle = async (social) => {
        try {
            await navigator.clipboard.writeText(social.handle);
            setCopied(social.id);
            setTimeout(() => setCopied(null), 1600);
        } catch {
            /* clipboard blocked */
        }
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim() || status === 'sending') return;
        setStatus('sending');
        setError(null);
        try {
            await submitFeedback({ message, email });
            setStatus('sent');
            setMessage('');
            setEmail('');
        } catch (err) {
            setStatus('error');
            setError(err.message || 'Could not send feedback.');
        }
    };

    return (
        <footer className="p-foot">
            <div className="p-container p-foot-grid">
                <div className="p-foot-brand">
                    <Brand />
                    <p>Search the web with text, images, audio and video in one query, and ask your documents questions.</p>
                    <ul className="p-socials">
                        {SOCIALS.map((s) => (
                            <li key={s.id}>
                                {s.href ? (
                                    <a
                                        href={s.href}
                                        aria-label={s.label}
                                        title={s.label}
                                        target={s.href.startsWith('http') ? '_blank' : undefined}
                                        rel={s.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                                    >
                                        <i className={s.icon} aria-hidden="true" />
                                    </a>
                                ) : (
                                    <button
                                        type="button"
                                        aria-label={copied === s.id ? 'Discord handle copied' : s.label}
                                        title={copied === s.id ? 'Copied' : s.label}
                                        data-copied={copied === s.id}
                                        onClick={() => copyHandle(s)}
                                    >
                                        <i className={copied === s.id ? 'fa-solid fa-check' : s.icon} aria-hidden="true" />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                <nav className="p-foot-col" aria-label="Product">
                    <h3>Product</h3>
                    <ul>
                        {PRODUCT_LINKS.map((l) => <li key={l.to}><Link to={l.to}>{l.label}</Link></li>)}
                    </ul>
                </nav>

                <nav className="p-foot-col" aria-label="Legal">
                    <h3>Legal</h3>
                    <ul>
                        {LEGAL_LINKS.map((l) => <li key={l.to}><Link to={l.to}>{l.label}</Link></li>)}
                    </ul>
                </nav>

                <div className="p-foot-col p-foot-feedback">
                    <h3>Feedback</h3>
                    {status === 'sent' ? (
                        <div className="p-form-ok" role="status">
                            <i className="fa-solid fa-check" aria-hidden="true" />
                            Thanks, we got it.
                            <button type="button" className="p-text-btn" onClick={() => setStatus('idle')}>Send another</button>
                        </div>
                    ) : (
                        <form className="p-form" onSubmit={onSubmit}>
                            <div className="p-field">
                                <label htmlFor="p-feedback-msg">What could be better?</label>
                                <textarea
                                    id="p-feedback-msg"
                                    className="p-input"
                                    rows={3}
                                    maxLength={4000}
                                    required
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    style={{ resize: 'vertical' }}
                                />
                            </div>
                            <div className="p-field">
                                <label htmlFor="p-feedback-email">Email (optional)</label>
                                <input
                                    id="p-feedback-email"
                                    className="p-input"
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            {error && <p className="p-form-error" role="alert">{error}</p>}
                            <button type="submit" className="p-btn p-btn-ghost" disabled={!message.trim() || status === 'sending'}>
                                {status === 'sending' ? 'Sending...' : 'Send feedback'}
                            </button>
                        </form>
                    )}
                </div>
            </div>

            <div className="p-container p-foot-bottom">
                <span className="p-mono p-dim">&copy; {new Date().getFullYear()} Neuron</span>
                <span className="p-mono p-dim">FastAPI, React, CLIP, Whisper, FAISS</span>
            </div>
        </footer>
    );
}
