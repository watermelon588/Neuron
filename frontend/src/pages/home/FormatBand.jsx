import { useRef } from 'react';
import { gsap, ScrollTrigger, useGsap } from '../../hooks/useGsap';
import logo from '../../assets/logo/logo2-128.png';

const ITEMS = ['Text', 'Images', 'Audio', 'Video', 'PDF', 'Word', 'Markdown', 'CSV', 'Excel', 'Code'];

function BandSet() {
    return (
        <div className="h-band-set" aria-hidden="true">
            {ITEMS.map((item) => (
                <span key={item} className="h-band-item">
                    <span>{item}</span>
                    <img src={logo} alt="" />
                </span>
            ))}
        </div>
    );
}

/** The page's one marquee: every input Neuron understands. */
export default function FormatBand() {
    const rootRef = useRef(null);

    useGsap((c) => {
        if (!c.motion) return;
        const loop = gsap.to('.h-band-track', { xPercent: -50, duration: 32, ease: 'none', repeat: -1 });
        // Scrolling fast pushes the band faster, then it settles.
        ScrollTrigger.create({
            trigger: rootRef.current,
            start: 'top bottom',
            end: 'bottom top',
            onUpdate(self) {
                const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 300, 5);
                gsap.to(loop, { timeScale: boost, duration: 0.2, overwrite: true });
                gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.2 });
            },
        });
    }, rootRef);

    return (
        <div ref={rootRef} className="h-band">
            <p className="p-sr-only">Neuron accepts text, images, audio, video, PDF, Word, Markdown, CSV, Excel and source code.</p>
            <div className="h-band-track">
                <BandSet />
                <BandSet />
            </div>
        </div>
    );
}
