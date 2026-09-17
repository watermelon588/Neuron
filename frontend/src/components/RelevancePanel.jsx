import { useId, useState } from 'react';
import { SIGNAL_LABELS } from '../lib/signals';

export function ConfidenceBadge({ level }) {
    if (!level) return null;
    return <span className="p-tier" data-tier={level}>{level}</span>;
}

/** Relevance as a number, never a filled progress track. */
export function Score({ score, label = 'relevance' }) {
    return (
        <span className="r-score">
            <b className="p-mono">{Math.round((score ?? 0) * 100)}</b>
            <span className="p-dim">{label}</span>
        </span>
    );
}

/**
 * Expandable "Why this result?" block showing the relevance analysis the
 * backend attaches to every search result.
 */
export default function RelevancePanel({ analysis }) {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    if (!analysis) return null;

    return (
        <div className="r-wrap">
            <div className="r-row">
                <Score score={analysis.relevance_score} />
                <ConfidenceBadge level={analysis.confidence} />
                <button
                    type="button"
                    className="r-toggle"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); }}
                >
                    {open ? 'Hide analysis' : 'Why this result?'}
                    <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'}`} aria-hidden="true" />
                </button>
            </div>

            {open && (
                <div id={panelId} className="r-panel">
                    {analysis.explanation && <p className="r-explain">{analysis.explanation}</p>}
                    <dl className="r-signals">
                        {analysis.signals?.map(signal => (
                            <div key={signal.name}>
                                <dt>{SIGNAL_LABELS[signal.name] || signal.name}</dt>
                                <dd className="p-mono">
                                    {Math.round(signal.score * 100)}
                                    <span className="p-dim"> w{Math.round(signal.weight * 100)}</span>
                                </dd>
                            </div>
                        ))}
                    </dl>
                    {analysis.matched_terms?.length > 0 && (
                        <ul className="r-terms" aria-label="Matched terms">
                            {analysis.matched_terms.slice(0, 8).map(term => (
                                <li key={term} className="p-mono">{term}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
