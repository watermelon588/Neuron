import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { gsap } from '../../hooks/useGsap';
import { Brand, Avatar } from './Brand';
import { PRIMARY_LINKS, LEGAL_LINKS } from './links';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function PulseNav() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);

    const sideRef = useRef(null);
    const menuBtnRef = useRef(null);
    const tlRef = useRef(null);

    const signOut = async () => {
        setOpen(false);
        await logout();
        navigate('/');
    };

    // Build the drawer timeline once. Links condense-to-wide as they enter,
    // the same width gesture the hero headline uses.
    useLayoutEffect(() => {
        const root = sideRef.current;
        const ctx = gsap.context(() => {
            tlRef.current = gsap.timeline({
                paused: true,
                defaults: { ease: 'expo.out' },
                onReverseComplete: () => { root.dataset.open = 'false'; },
            })
                .to('.p-side-scrim', { opacity: 1, duration: 0.35, ease: 'power2.out' }, 0)
                .fromTo('.p-side-panel', { xPercent: -100, x: 0 }, { xPercent: 0, duration: 0.6, immediateRender: true }, 0)
                .from('.p-side-links a span', {
                    yPercent: 110, fontStretch: '62%', duration: 0.7, stagger: 0.05,
                }, 0.12)
                .from('.p-side-account, .p-side-foot', { opacity: 0, y: 16, duration: 0.5, stagger: 0.06 }, 0.3);
        }, root);
        return () => ctx.revert();
    }, []);

    const close = useCallback(() => setOpen(false), []);

    useEffect(() => {
        const root = sideRef.current;
        const tl = tlRef.current;
        if (!tl) return undefined;

        if (open) {
            root.dataset.open = 'true';
            if (reduced()) tl.progress(1); else tl.timeScale(1).play();
            document.documentElement.style.overflow = 'hidden';
            const first = root.querySelector('.p-side-close');
            first?.focus();
            const onKey = (e) => {
                if (e.key === 'Escape') { close(); return; }
                if (e.key !== 'Tab') return;
                const focusables = root.querySelectorAll('a, button:not(.p-side-scrim)');
                const list = [...focusables];
                const i = list.indexOf(document.activeElement);
                if (e.shiftKey && i <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
                if (!e.shiftKey && i === list.length - 1) { e.preventDefault(); list[0].focus(); }
            };
            document.addEventListener('keydown', onKey);
            return () => document.removeEventListener('keydown', onKey);
        }

        document.documentElement.style.overflow = '';
        if (root.dataset.open === 'true') {
            if (reduced()) { tl.progress(0); root.dataset.open = 'false'; } else tl.timeScale(1.6).reverse();
            menuBtnRef.current?.focus({ preventScroll: true });
        }
        return undefined;
    }, [open, close]);

    // Close on navigation (adjust state during render, not in an effect).
    const [lastPath, setLastPath] = useState(pathname);
    if (lastPath !== pathname) {
        setLastPath(pathname);
        setOpen(false);
    }

    // Close if we grow past the drawer breakpoint.
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 900px)');
        const onChange = (e) => { if (e.matches) setOpen(false); };
        mq.addEventListener('change', onChange);
        return () => {
            mq.removeEventListener('change', onChange);
            document.documentElement.style.overflow = '';
        };
    }, []);

    const current = (to) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

    return (
        <>
            <header className="p-nav">
                <div className="p-container p-nav-inner">
                    <Brand />

                    <nav className="p-nav-links" aria-label="Primary">
                        {PRIMARY_LINKS.map((l) => (
                            <Link key={l.to} to={l.to} aria-current={current(l.to) ? 'page' : undefined}>
                                {l.label}
                                {l.protected && !user && (
                                    <i className="fa-solid fa-lock p-nav-lock" aria-label="(sign in required)" />
                                )}
                            </Link>
                        ))}
                    </nav>

                    <div className="p-nav-account">
                        {user ? (
                            <>
                                <Link to="/profile" className="p-user-link" title="Your profile">
                                    <Avatar user={user} />
                                    <span>{user.display_name}</span>
                                </Link>
                                <button type="button" className="p-btn p-btn-ghost" onClick={signOut}>Sign out</button>
                            </>
                        ) : (
                            <Link to="/login" className="p-btn p-btn-accent">
                                Sign in <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                            </Link>
                        )}
                    </div>

                    <button
                        ref={menuBtnRef}
                        type="button"
                        className="p-menu-btn"
                        aria-label="Open menu"
                        aria-expanded={open}
                        aria-controls="pulse-side-nav"
                        onClick={() => setOpen(true)}
                    >
                        <i className="fa-solid fa-bars" aria-hidden="true" />
                    </button>
                </div>
            </header>

            <div
                ref={sideRef}
                id="pulse-side-nav"
                className="p-side"
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                aria-hidden={!open}
            >
                <button type="button" className="p-side-scrim" tabIndex={-1} aria-label="Close menu" onClick={close} />
                <div className="p-side-panel">
                    <div className="p-side-top">
                        <Brand />
                        <button type="button" className="p-side-close" aria-label="Close menu" onClick={close}>
                            <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                    </div>

                    <nav aria-label="Primary">
                        <ul className="p-side-links">
                            {[...PRIMARY_LINKS, ...(user ? [{ label: 'Profile', to: '/profile' }] : [])].map((l) => (
                                <li key={l.to}>
                                    <Link to={l.to} aria-current={current(l.to) ? 'page' : undefined} onClick={close}>
                                        <span>{l.label}</span>
                                        <i
                                            className={`fa-solid ${l.protected && !user ? 'fa-lock' : 'fa-arrow-right'}`}
                                            aria-hidden="true"
                                        />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="p-side-account">
                        {user ? (
                            <>
                                <Link to="/profile" className="p-side-user" onClick={close}>
                                    <Avatar user={user} />
                                    <span><b>{user.display_name}</b><small>{user.email}</small></span>
                                </Link>
                                <button type="button" className="p-btn p-btn-ghost" onClick={signOut}>Sign out</button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="p-btn p-btn-accent p-btn-lg" onClick={close}>Sign in</Link>
                                <Link to="/register" className="p-btn p-btn-ghost p-btn-lg" onClick={close}>Create account</Link>
                            </>
                        )}
                    </div>

                    <div className="p-side-foot">
                        <nav aria-label="Legal">
                            {LEGAL_LINKS.map((l) => <Link key={l.to} to={l.to} onClick={close}>{l.label}</Link>)}
                        </nav>
                        <span className="p-mono p-dim">&copy; {new Date().getFullYear()} Neuron</span>
                    </div>
                </div>
            </div>
        </>
    );
}
