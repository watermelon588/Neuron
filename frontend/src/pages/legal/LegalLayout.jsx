import { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PulseLayout from '../../components/pulse/PulseLayout';
import { gsap, useGsap } from '../../hooks/useGsap';

/** Shared chrome for the Terms and Privacy pages. */
export default function LegalLayout({ title, updated, children }) {
    const rootRef = useRef(null);
    const { pathname } = useLocation();

    useGsap((c) => {
        if (!c.motion) return;
        gsap.from('.l-title', { yPercent: 100, fontStretch: '62%', duration: 1.1, ease: 'expo.out' });
        gsap.utils.toArray('.l-section').forEach((s) => {
            gsap.from(s, {
                y: 28, opacity: 0, duration: 0.8, ease: 'expo.out',
                scrollTrigger: { trigger: s, start: 'top 88%', once: true },
            });
        });
    }, rootRef);

    return (
        <PulseLayout>
            <div ref={rootRef} className="p-container l-wrap">
                <aside className="l-aside">
                    <nav aria-label="Legal pages">
                        <Link to="/terms" aria-current={pathname === '/terms' ? 'page' : undefined}>Terms &amp; Conditions</Link>
                        <Link to="/privacy" aria-current={pathname === '/privacy' ? 'page' : undefined}>Privacy Policy</Link>
                    </nav>
                    <p className="p-mono p-dim">Last updated {updated}</p>
                </aside>
                <article className="l-article">
                    <h1 className="l-title-wrap"><span className="l-title">{title}</span></h1>
                    <div className="l-body">{children}</div>
                    <Link to="/" className="p-link l-back">Back to Neuron</Link>
                </article>
            </div>
        </PulseLayout>
    );
}

/* ── Reusable section pieces ─────────────────────────────────────────── */

export function Section({ heading, children }) {
    return (
        <section className="l-section">
            <h2>{heading}</h2>
            <div className="l-copy">{children}</div>
        </section>
    );
}

export function Bullets({ items }) {
    return (
        <ul className="l-bullets">
            {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
    );
}
