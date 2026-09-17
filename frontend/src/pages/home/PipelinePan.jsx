import { useRef } from 'react';
import { gsap, useGsap } from '../../hooks/useGsap';
import understand from '../../assets/home/understand.webp';
import retrieve from '../../assets/home/retrieve.webp';
import rank from '../../assets/home/rank.webp';
import explain from '../../assets/home/explain.webp';

/* The real search pipeline: services/search understanding -> retrieval -> ranking -> transparency. */
const STAGES = [
    {
        word: 'Understand',
        img: understand,
        alt: 'Double-exposed portrait, two views blended into one',
        body: 'Whisper transcribes audio, video is sampled into frames, and every input is fused into one CLIP query vector plus a keyword query.',
        detail: <><i className="fa-regular fa-image" aria-hidden="true" /> image <span className="p-dim">+</span> <i className="fa-solid fa-microphone" aria-hidden="true" /> audio <span className="p-dim">+</span> text <span className="p-mono p-accent-text">= 1 query</span></>,
    },
    {
        word: 'Retrieve',
        img: retrieve,
        alt: 'Figure in motion, lit from inside',
        body: 'The live web is searched once for pages, images, videos and news, so one query returns every kind of result.',
        detail: <><span className="p-mono">web</span><span className="p-mono">images</span><span className="p-mono">videos</span><span className="p-mono">news</span></>,
    },
    {
        word: 'Rank',
        img: rank,
        alt: 'Portrait with a liquid reflection across the eyes',
        body: 'Results are re-ranked by what they mean and what they look like. Image and video thumbnails are compared by real pixel similarity.',
        detail: <><i className="fa-solid fa-layer-group p-accent-text" aria-hidden="true" /> dense embedding, BM25, visual match, provider position</>,
    },
    {
        word: 'Explain',
        img: explain,
        alt: 'Glowing violet head, eyes closed',
        body: 'Every result carries a score, a confidence tier and a plain-language reason. An unexplained ranked list is impossible by design.',
        detail: <><span className="why-tier" data-tier="high">High</span><span className="why-tier" data-tier="medium">Medium</span><span className="why-tier" data-tier="low">Low</span></>,
    },
];

export default function PipelinePan() {
    const rootRef = useRef(null);
    const trackRef = useRef(null);

    useGsap((c) => {
        if (!c.motion) return;
        const panels = gsap.utils.toArray('.h-panel');

        if (!c.desktop) {
            panels.forEach((panel) => {
                gsap.from(panel.children, {
                    y: 40, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.1,
                    scrollTrigger: { trigger: panel, start: 'top 82%', once: true },
                });
            });
            return;
        }

        // Pinned horizontal pan: vertical scroll drives the track sideways.
        const track = trackRef.current;
        const distance = () => track.scrollWidth - window.innerWidth;
        const pan = gsap.to(track, {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
                trigger: rootRef.current,
                start: 'top top',
                end: () => `+=${distance()}`,
                pin: true,
                scrub: 1,
                invalidateOnRefresh: true,
            },
        });

        panels.forEach((panel) => {
            gsap.fromTo(panel.querySelector('.h-panel-fig img'), { xPercent: -7 }, {
                xPercent: 7, ease: 'none',
                scrollTrigger: { trigger: panel, containerAnimation: pan, start: 'left right', end: 'right left', scrub: true },
            });
            gsap.from(panel.querySelector('.h-panel-word'), {
                yPercent: 100, fontStretch: '62%', duration: 1.2, ease: 'expo.out',
                scrollTrigger: { trigger: panel, containerAnimation: pan, start: 'left 70%', toggleActions: 'play none none reverse' },
            });
        });
    }, rootRef);

    return (
        <section ref={rootRef} className="h-pipe" aria-labelledby="pipe-title">
            <div ref={trackRef} className="h-pipe-track">
                <div className="h-pipe-intro">
                    <h2 id="pipe-title" className="p-display h-pipe-title">One query, four passes.</h2>
                    <p className="p-lede">What happens between pressing search and reading the first result.</p>
                </div>

                {STAGES.map((s, i) => (
                    <article key={s.word} className={`h-panel${i % 2 ? ' h-panel--flip' : ''}`}>
                        <figure className="h-panel-fig">
                            <img src={s.img} alt={s.alt} loading="lazy" />
                        </figure>
                        <div className="h-panel-text">
                            <h3 className={`h-panel-word${i % 2 ? ' is-outline' : ''}`}>{s.word}</h3>
                            <div>
                                <p>{s.body}</p>
                                <div className="h-detail">{s.detail}</div>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
