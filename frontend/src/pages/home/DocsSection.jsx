import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { gsap, useGsap } from '../../hooks/useGsap';

const FORMATS = ['PDF', 'DOCX', 'TXT', 'Markdown', 'CSV', 'Excel', 'HTML', 'XML', 'JSON', 'Source code'];

/* Example answer mirroring a real Neuron chat over a system-design guide. */
const SOURCES = [
    {
        file: 'System_Design_Interview_Guide.pdf',
        where: 'Page 57, chunk 85',
        heading: 'Prerequisite for horizontal scaling: statelessness',
        text: 'App servers must not keep session data in local memory. Move state to shared storage such as Redis, or encode it in a signed token.',
    },
    {
        file: 'System_Design_Interview_Guide.pdf',
        where: 'Page 58, chunk 86',
        heading: 'Microservices, pros',
        text: 'Teams deploy independently and scale only the service that needs it. One service crashing does not take down the rest.',
    },
    {
        file: 'System_Design_Interview_Guide.pdf',
        where: 'Page 41, chunk 62',
        heading: 'Load balancing',
        text: 'A load balancer spreads requests across identical servers, so capacity grows by adding machines instead of upgrading one.',
    },
];

function CitationDemo() {
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);
    const rootRef = useRef(null);
    const src = SOURCES[active];

    useEffect(() => {
        if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
        const id = setInterval(() => setActive((i) => (i + 1) % SOURCES.length), 4200);
        return () => clearInterval(id);
    }, [paused]);

    useGsap((c) => {
        if (!c.motion) return;
        gsap.from('.cd-source > *', { y: 12, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.05 });
        gsap.fromTo('.cd-mark', { backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%', duration: 0.9, ease: 'power2.inOut', delay: 0.15 });
    }, rootRef, [active]);

    const cite = (n) => (
        <button
            type="button"
            className="cd-cite"
            aria-pressed={active === n}
            aria-label={`Show source ${n + 1}`}
            onClick={() => setActive(n)}
            onPointerEnter={() => setActive(n)}
        >
            {n + 1}
        </button>
    );

    return (
        <div
            ref={rootRef}
            className="cd"
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            <div className="cd-q">
                <span className="p-mono p-dim">You asked</span>
                <p>Why do app servers need to be stateless to scale?</p>
            </div>

            <div className="cd-a">
                <p>
                    Horizontal scaling puts many identical servers behind a load balancer {cite(2)}.
                    That only works if any server can handle any request, so session data has to live
                    outside the app server {cite(0)}. It is the same property that lets microservices
                    scale one service at a time {cite(1)}.
                </p>
                <div className="cd-meta p-mono">
                    <span><i className="fa-solid fa-circle-check" aria-hidden="true" /> Grounded in 3 passages</span>
                    <span className="p-dim">Example</span>
                </div>
            </div>

            <div className="cd-source" aria-live="polite">
                <div className="cd-file p-mono">
                    <i className="fa-regular fa-file-pdf p-accent-text" aria-hidden="true" />
                    <span>{src.file}</span>
                </div>
                <span className="p-mono p-accent-text">{src.where}</span>
                <b>{src.heading}</b>
                <p><span className="cd-mark">{src.text}</span></p>
            </div>
        </div>
    );
}

export default function DocsSection() {
    const rootRef = useRef(null);

    useGsap((c) => {
        if (!c.motion) return;
        gsap.from('.h-docs-copy > *', {
            y: 36, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08,
            scrollTrigger: { trigger: rootRef.current, start: 'top 72%', once: true },
        });
        gsap.from('.cd', {
            clipPath: 'inset(0% 0% 100% 0%)', duration: 1.3, ease: 'expo.inOut',
            scrollTrigger: { trigger: '.cd', start: 'top 80%', once: true },
        });
        gsap.from('.h-formats li', {
            opacity: 0, x: -12, duration: 0.5, ease: 'power3.out', stagger: 0.035,
            scrollTrigger: { trigger: '.h-formats', start: 'top 90%', once: true },
        });
    }, rootRef);

    return (
        <section ref={rootRef} className="h-docs p-container" aria-labelledby="docs-title">
            <div className="h-docs-copy">
                <h2 id="docs-title" className="p-h2">Ask your documents.</h2>
                <p className="p-lede">
                    Upload a file and chat with it. Answers cite the page, section and line range,
                    and a click opens the source scrolled to that passage.
                </p>
                <ul className="h-points">
                    <li><i className="fa-solid fa-location-crosshairs" aria-hidden="true" /> Citations that point to the exact chunk</li>
                    <li><i className="fa-solid fa-globe" aria-hidden="true" /> Live web results when your files are thin on a topic</li>
                    <li><i className="fa-solid fa-lock" aria-hidden="true" /> Only you can query what you upload</li>
                </ul>
                <ul className="h-formats" aria-label="Supported formats">
                    {FORMATS.map((f) => <li key={f} className="p-mono">{f}</li>)}
                </ul>
                <Link to="/documents" className="p-btn p-btn-accent p-btn-lg">
                    Upload a document <i className="fa-solid fa-arrow-up-from-bracket" aria-hidden="true" />
                </Link>
            </div>

            <CitationDemo />
        </section>
    );
}
