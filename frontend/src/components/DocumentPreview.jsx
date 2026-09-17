import { useEffect, useMemo, useRef, useState } from 'react';
import { getDocumentChunks } from '../services/documentsApi';
import { gsap } from '../hooks/useGsap';

/**
 * Renders a document's indexed chunks in order and, when given a
 * `targetChunkId`, scrolls to and highlights that exact chunk. This turns a
 * citation into "take me to the source".
 *
 * Props: documentId, documentName?, targetChunkId?, onClose?
 */
export default function DocumentPreview({ documentId, documentName, targetChunkId, onClose }) {
    const [chunks, setChunks] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const chunkRefs = useRef({});

    useEffect(() => {
        if (!documentId) return undefined;
        let cancelled = false;
        /* eslint-disable-next-line react-hooks/set-state-in-effect */
        setLoading(true); setError(null); setChunks(null);
        getDocumentChunks(documentId)
            .then(data => { if (!cancelled) setChunks(data.chunks); })
            .catch(err => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [documentId]);

    // Scroll the target chunk into view and flash it once rendered.
    useEffect(() => {
        if (!chunks || !targetChunkId) return undefined;
        const el = chunkRefs.current[targetChunkId];
        if (!el) return undefined;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const id = requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
            if (!reduce) {
                gsap.fromTo(el, { backgroundColor: 'rgba(255, 90, 31, 0.35)' }, {
                    backgroundColor: 'rgba(255, 90, 31, 0.14)', duration: 1.4, ease: 'power2.out', delay: 0.35,
                });
            }
        });
        return () => cancelAnimationFrame(id);
    }, [chunks, targetChunkId]);

    const title = documentName || chunks?.[0]?.location?.document_name || 'Document';

    return (
        <div className="dp">
            <div className="dp-head">
                <div className="dp-title">
                    <span className="p-mono p-dim">Source document</span>
                    <b title={title}>{title}</b>
                </div>
                {chunks && <span className="p-mono p-dim">{chunks.length} chunks</span>}
                {onClose && (
                    <button type="button" className="dp-close" onClick={onClose} aria-label="Close preview">
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                )}
            </div>
            <div className="dp-body">
                {!documentId && (
                    <div className="dp-empty">
                        <i className="fa-solid fa-quote-left" aria-hidden="true" />
                        <p>Click a citation like <span className="dp-cite">1</span> in an answer to open its source here, scrolled to the exact passage.</p>
                    </div>
                )}
                {loading && (
                    <div className="dp-skel" aria-busy="true" aria-label="Loading document">
                        {[1, 2, 3].map(i => <span key={i} className="p-skel" />)}
                    </div>
                )}
                {error && <p className="p-alert" role="alert">{error}</p>}
                {chunks && chunks.map(chunk => (
                    <ChunkBlock
                        key={chunk.location.chunk_id}
                        ref={el => { chunkRefs.current[chunk.location.chunk_id] = el; }}
                        chunk={chunk}
                        highlighted={chunk.location.chunk_id === targetChunkId}
                    />
                ))}
                {chunks && chunks.length === 0 && <p className="p-hint">No extractable content in this file.</p>}
            </div>
        </div>
    );
}

function ChunkBlock({ chunk, highlighted, ref }) {
    const loc = chunk.location;
    const locationLabel = useMemo(() => [
        loc.page_number ? `Page ${loc.page_number}` : null,
        loc.section ? `Section ${loc.section}` : null,
        loc.line_start ? `Lines ${loc.line_start}-${loc.line_end ?? loc.line_start}` : null,
        `Chunk ${loc.ordinal + 1}`,
    ].filter(Boolean).join(', '), [loc]);

    return (
        <div ref={ref} className="dp-chunk" data-highlighted={highlighted}>
            <p className="dp-loc p-mono">{locationLabel}</p>
            <p className="dp-text">{chunk.text}</p>
        </div>
    );
}
