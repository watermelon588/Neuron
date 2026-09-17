import { useEffect, useRef, useState } from 'react';
import { ConfidenceBadge } from './RelevancePanel';
import { SIGNAL_LABELS } from '../lib/signals';
import { gsap } from '../hooks/useGsap';

/**
 * Full-size image viewer that slides in from the right, with credits,
 * description and the full ranking breakdown.
 */
export default function ImageDetailPanel({ item, onClose, onPrev, onNext }) {
    const asideRef = useRef(null);
    const closeRef = useRef(null);
    const open = Boolean(item);

    // Escape closes; arrows step through the result set.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowRight') onNext?.();
            if (event.key === 'ArrowLeft') onPrev?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, onNext, onPrev]);

    // Lock page scroll, focus the close button, animate in.
    useEffect(() => {
        if (!open) return undefined;
        const previous = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        const opener = document.activeElement;
        closeRef.current?.focus({ preventScroll: true });
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            gsap.fromTo(asideRef.current, { xPercent: 100 }, { xPercent: 0, duration: 0.55, ease: 'expo.out' });
            gsap.fromTo('.idp-scrim', { opacity: 0 }, { opacity: 1, duration: 0.3 });
        }
        return () => {
            document.documentElement.style.overflow = previous;
            opener?.focus?.({ preventScroll: true });
        };
    }, [open]);

    if (!item) return null;
    const analysis = item.analysis;

    return (
        <>
            <div className="idp-scrim" onClick={onClose} aria-hidden="true" />
            <aside ref={asideRef} className="idp" role="dialog" aria-modal="true" aria-label="Image details">
                <header className="idp-head">
                    <span className="p-mono">Rank #{(item.rank ?? 0) + 1}</span>
                    {analysis && <ConfidenceBadge level={analysis.confidence} />}
                    <div className="idp-nav">
                        {onPrev && <IconButton icon="fa-chevron-left" label="Previous image" onClick={onPrev} />}
                        {onNext && <IconButton icon="fa-chevron-right" label="Next image" onClick={onNext} />}
                        <IconButton ref={closeRef} icon="fa-xmark" label="Close" onClick={onClose} />
                    </div>
                </header>

                <div className="idp-body">
                    <div className="idp-image">
                        <FullImage
                            key={item.image_url || item.thumbnail_url}
                            src={item.image_url || item.thumbnail_url}
                            alt={item.title || 'Result image'}
                        />
                    </div>

                    {item.title && (
                        <section>
                            <h3 className="idp-label">Description</h3>
                            <p className="idp-title">{item.title}</p>
                            {item.snippet && <p className="idp-snippet">{item.snippet}</p>}
                        </section>
                    )}

                    <section>
                        <h3 className="idp-label">Credits</h3>
                        <dl className="idp-meta">
                            {item.source && <><dt>Source</dt><dd>{item.source}</dd></>}
                            {item.date && <><dt>Date</dt><dd>{item.date}</dd></>}
                            {item.url && (
                                <>
                                    <dt>Origin</dt>
                                    <dd>
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="idp-url p-mono">
                                            {item.url} <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                                        </a>
                                    </dd>
                                </>
                            )}
                        </dl>
                    </section>

                    {analysis && (
                        <section>
                            <h3 className="idp-label">Ranking</h3>
                            <div className="idp-overall">
                                <span>Overall relevance</span>
                                <b className="p-mono">{Math.round(analysis.relevance_score * 100)}</b>
                            </div>
                            {analysis.explanation && <p className="idp-snippet">{analysis.explanation}</p>}
                            <ul className="idp-signals">
                                {analysis.signals?.map(signal => (
                                    <li key={signal.name}>
                                        <div>
                                            <b>{SIGNAL_LABELS[signal.name] || signal.name}</b>
                                            <span className="p-mono">
                                                {Math.round(signal.score * 100)}
                                                <span className="p-dim"> weight {Math.round(signal.weight * 100)}%</span>
                                            </span>
                                        </div>
                                        {signal.explanation && <p>{signal.explanation}</p>}
                                    </li>
                                ))}
                            </ul>
                            {analysis.matched_terms?.length > 0 && (
                                <>
                                    <h3 className="idp-label" style={{ marginTop: 20 }}>Matched terms</h3>
                                    <ul className="r-terms">
                                        {analysis.matched_terms.map(term => <li key={term} className="p-mono">{term}</li>)}
                                    </ul>
                                </>
                            )}
                        </section>
                    )}
                </div>
            </aside>
        </>
    );
}

function FullImage({ src, alt }) {
    const [failed, setFailed] = useState(false);
    if (failed || !src) {
        return <span className="p-dim" style={{ padding: 48 }}>Image could not be loaded</span>;
    }
    return <img src={src} alt={alt} onError={() => setFailed(true)} />;
}

function IconButton({ icon, label, onClick, ref }) {
    return (
        <button ref={ref} type="button" className="idp-btn" onClick={onClick} aria-label={label} title={label}>
            <i className={`fa-solid ${icon}`} aria-hidden="true" />
        </button>
    );
}
