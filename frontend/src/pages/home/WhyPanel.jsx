import { useEffect, useRef, useState } from 'react';
import { gsap, useGsap } from '../../hooks/useGsap';

/*
 * Illustrative examples of the transparency block every Neuron result
 * carries. Scores are sample values, labelled "Example" in the UI.
 */
const EXAMPLES = [
    {
        inputs: [
            { icon: 'fa-regular fa-image', label: 'portrait.jpg' },
            { icon: 'fa-solid fa-font', label: '"blue light portrait"' },
        ],
        result: 'Light painting portraits, a practical guide',
        tier: 'High',
        signals: [['Visual similarity', '0.84'], ['Dense embedding', '0.77'], ['BM25 keywords', '0.61'], ['Provider position', '#2']],
        reason: 'The thumbnail looks like your image and the title repeats your words.',
    },
    {
        inputs: [
            { icon: 'fa-solid fa-microphone', label: 'voice-note.webm' },
        ],
        result: 'Green Tree Frog, Australian Museum',
        tier: 'High',
        signals: [['Visual similarity', '0.72'], ['Dense embedding', '0.81'], ['BM25 keywords', '0.88'], ['Provider position', '#1']],
        reason: 'Whisper heard "green tree frog call", which matches the title exactly.',
    },
    {
        inputs: [
            { icon: 'fa-solid fa-film', label: 'clip.mp4' },
            { icon: 'fa-solid fa-font', label: '"iris close up"' },
        ],
        result: 'Macro photography of the human eye',
        tier: 'Medium',
        signals: [['Visual similarity', '0.58'], ['Dense embedding', '0.66'], ['BM25 keywords', '0.79'], ['Provider position', '#6']],
        reason: 'Strong keyword match, but the frames only partly resemble the result.',
    },
];

export default function WhyPanel() {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const rootRef = useRef(null);
    const example = EXAMPLES[index];

    useEffect(() => {
        if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
        const id = setInterval(() => setIndex((i) => (i + 1) % EXAMPLES.length), 5600);
        return () => clearInterval(id);
    }, [paused]);

    useGsap((c) => {
        if (!c.motion) return;
        gsap.from('.why-anim', { y: 10, opacity: 0, duration: 0.55, ease: 'power3.out', stagger: 0.045 });
        gsap.from('.why-val', {
            textContent: 0, duration: 0.9, ease: 'power2.out', snap: { textContent: 0.01 },
            stagger: 0.05,
            onUpdate() {
                this.targets().forEach((t) => {
                    if (!t.dataset.final.startsWith('#')) t.textContent = Number(t.textContent).toFixed(2);
                });
            },
            onComplete() { this.targets().forEach((t) => { t.textContent = t.dataset.final; }); },
        });
    }, rootRef, [index]);

    return (
        <div
            ref={rootRef}
            className="h-why"
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            <div className="why-top">
                <span className="p-mono">Why it ranked #1</span>
                <span className="p-mono p-dim">Example</span>
            </div>

            <ul className="why-inputs" aria-label="Query inputs">
                {example.inputs.map((inp) => (
                    <li key={inp.label} className="why-anim">
                        <i className={inp.icon} aria-hidden="true" /> <span className="p-mono">{inp.label}</span>
                    </li>
                ))}
                <li className="why-anim why-fused p-mono">= one CLIP vector + keyword query</li>
            </ul>

            <div className="why-result why-anim">
                <b>{example.result}</b>
                <span className="why-tier" data-tier={example.tier.toLowerCase()}>{example.tier}</span>
            </div>

            <dl className="why-signals">
                {example.signals.map(([label, value]) => (
                    <div key={label} className="why-anim">
                        <dt>{label}</dt>
                        <dd className="p-mono">
                            {value.startsWith('#')
                                ? value
                                : <span className="why-val" data-final={value}>{value}</span>}
                        </dd>
                    </div>
                ))}
            </dl>

            <p className="why-reason why-anim" aria-live="polite">{example.reason}</p>

            <button
                type="button"
                className="why-next p-mono"
                onClick={() => setIndex((i) => (i + 1) % EXAMPLES.length)}
            >
                Next example <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
        </div>
    );
}
