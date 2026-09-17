import { useRef } from 'react';
import { gsap, useGsap } from '../../hooks/useGsap';

export default function CloseCta() {
    const rootRef = useRef(null);

    useGsap((c) => {
        if (!c.motion) return;
        // The headline opens from condensed to wide as it scrolls in.
        gsap.fromTo('.h-close-title', { fontStretch: '62%' }, {
            fontStretch: '125%', ease: 'none',
            scrollTrigger: { trigger: rootRef.current, start: 'top bottom', end: 'top 30%', scrub: true },
        });
    }, rootRef);

    const startSearching = () => {
        const input = document.getElementById('home-search');
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        setTimeout(() => input?.focus({ preventScroll: true }), reduce ? 0 : 600);
    };

    return (
        <section ref={rootRef} className="h-close" aria-labelledby="close-title">
            <div className="p-container">
                <h2 id="close-title" className="h-close-title">Try a search.</h2>
                <div className="h-close-row">
                    <p>Type a question, drop in a photo, or hold the mic. Mix all three in one query.</p>
                    <button type="button" className="p-btn p-btn-dark p-btn-lg" onClick={startSearching}>
                        Start searching <i className="fa-solid fa-arrow-up" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </section>
    );
}
