import { useRef } from 'react';
import { gsap, useGsap } from '../../hooks/useGsap';
import prism from '../../assets/home/prism.webp';
import orb from '../../assets/home/orb.webp';
import baboon from '../../assets/home/baboon.webp';

export default function SystemBento() {
    const rootRef = useRef(null);

    useGsap((c) => {
        if (!c.motion) return;
        gsap.from('.h-cell', {
            y: 60, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08,
            scrollTrigger: { trigger: '.h-bento', start: 'top 78%', once: true },
        });
        gsap.from('.h-bento-title', {
            y: 40, opacity: 0, duration: 1, ease: 'expo.out',
            scrollTrigger: { trigger: rootRef.current, start: 'top 80%', once: true },
        });
        // Persistent: the fallback chain steps through itself.
        gsap.timeline({ repeat: -1, repeatDelay: 1.2 })
            .to('.h-chain li', {
                color: 'var(--p-accent)', duration: 0.3, stagger: { each: 1, yoyo: true, repeat: 1, repeatDelay: 0.5 },
            });
        // Image cells drift as they pass through the viewport.
        gsap.utils.toArray('.h-cell-img img').forEach((img) => {
            gsap.fromTo(img, { yPercent: -6 }, {
                yPercent: 6, ease: 'none',
                scrollTrigger: { trigger: img.closest('.h-cell'), start: 'top bottom', end: 'bottom top', scrub: true },
            });
        });
    }, rootRef);

    return (
        <section ref={rootRef} className="h-system p-container" aria-labelledby="system-title">
            <h2 id="system-title" className="p-h2 h-bento-title">Built to keep working.</h2>

            <div className="h-bento">
                <article className="h-cell h-cell--wide h-cell-img">
                    <img src={prism} alt="" loading="lazy" />
                    <div className="h-cell-body">
                        <i className="fa-solid fa-bolt" aria-hidden="true" />
                        <h3>Starts instantly</h3>
                        <p>CLIP, Whisper and BLIP load on first use. If one is missing, that capability switches off and the rest keeps running.</p>
                    </div>
                </article>

                <article className="h-cell">
                    <div className="h-cell-body">
                        <i className="fa-solid fa-code-branch" aria-hidden="true" />
                        <h3>Answers always come back</h3>
                        <ol className="h-chain p-mono">
                            <li>Groq hosted model</li>
                            <li>Local model</li>
                            <li>Cited extractive answer</li>
                        </ol>
                    </div>
                </article>

                <article className="h-cell h-cell-img h-cell--orb">
                    <img src={orb} alt="" loading="lazy" />
                    <div className="h-cell-body">
                        <i className="fa-solid fa-arrow-down-wide-short" aria-hidden="true" />
                        <h3>Honest fallbacks</h3>
                        <p>No embedder? Ranking falls back to BM25 and the response is flagged as degraded.</p>
                    </div>
                </article>

                <article className="h-cell h-cell--accent">
                    <div className="h-cell-body">
                        <i className="fa-solid fa-shield-halved" aria-hidden="true" />
                        <h3>Private by default</h3>
                        <p>httpOnly cookie sessions, PBKDF2 password hashing, CSRF and SSRF guards, and per-user document ownership.</p>
                    </div>
                </article>

                <article className="h-cell h-cell-img h-cell--baboon">
                    <img src={baboon} alt="" loading="lazy" />
                    <div className="h-cell-body">
                        <i className="fa-solid fa-terminal" aria-hidden="true" />
                        <h3>An open API</h3>
                        <p>Every capability is a versioned endpoint under <code>/api/v1</code>, with interactive docs.</p>
                    </div>
                </article>
            </div>
        </section>
    );
}
