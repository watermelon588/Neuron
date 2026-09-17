import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PulseLayout from '../components/pulse/PulseLayout';
import SearchBar from '../components/SearchBar';
import RelevancePanel, { ConfidenceBadge } from '../components/RelevancePanel';
import ImageDetailPanel from '../components/ImageDetailPanel';
import { search as searchApi } from '../services/searchApi';
import { getPendingFiles, clearPendingFiles } from '../fileStore';
import { saveResult as saveResultApi } from '../services/profileApi';
import { useAuth } from '../context/AuthContext';
import { gsap, useGsap } from '../hooks/useGsap';
import './search/search.css';

/* ─── Save (bookmark) button, visible only when signed in ───── */
function SaveButton({ item, compact = false }) {
    const { user } = useAuth();
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    if (!user) return null;

    const handleSave = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (saved || busy) return;
        setBusy(true);
        try {
            await saveResultApi({
                category: item.category,
                title: item.title,
                url: item.url,
                snippet: item.snippet,
                source: item.source,
                thumbnail_url: item.thumbnail_url,
                image_url: item.image_url,
            });
            setSaved(true);
        } catch {
            /* best-effort */
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            className={`s-save${compact ? ' s-save--compact' : ''}`}
            data-saved={saved}
            onClick={handleSave}
            aria-label={saved ? 'Saved to your profile' : `Save ${item.title || 'result'}`}
            title={saved ? 'Saved to your profile' : 'Save result'}
        >
            <i className={`fa-${saved ? 'solid' : 'regular'} fa-bookmark`} aria-hidden="true" />
            {!compact && (saved ? 'Saved' : 'Save')}
        </button>
    );
}

function SectionHeader({ title, count }) {
    return (
        <div className="s-section-head">
            <h2>{title}</h2>
            {count > 0 && <span className="p-count">{count}</span>}
        </div>
    );
}

function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function WebCard({ item }) {
    return (
        <article className="s-card s-web s-reveal">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="s-web-link">
                <span className="s-host p-mono">{hostOf(item.url)}</span>
                <h3>{item.title}</h3>
                {item.snippet && <p>{item.snippet}</p>}
                <i className="fa-solid fa-arrow-up-right s-arrow" aria-hidden="true" />
            </a>
            <div className="s-card-foot">
                <RelevancePanel analysis={item.analysis} />
                <SaveButton item={item} />
            </div>
        </article>
    );
}

function ImageCard({ item, onOpen }) {
    const [imgError, setImgError] = useState(false);
    return (
        <article className="s-image s-reveal">
            <button type="button" className="s-image-btn" onClick={onOpen} aria-label={`View ${item.title || 'image'} full size`}>
                <span className="s-image-frame">
                    {!imgError
                        ? <img src={item.image_url} alt="" loading="lazy" onError={() => setImgError(true)} />
                        : <span className="s-noimg"><i className="fa-regular fa-image" aria-hidden="true" /> No preview</span>}
                </span>
                <span className="s-image-cap">
                    <span className="s-image-title">{item.title}</span>
                    {item.source && <span className="p-mono p-dim">{item.source}</span>}
                </span>
            </button>
            <span className="s-image-tier"><ConfidenceBadge level={item.analysis?.confidence} /></span>
            <span className="s-image-save"><SaveButton item={item} compact /></span>
        </article>
    );
}

function VideoCard({ item }) {
    const [thumbError, setThumbError] = useState(false);
    return (
        <article className="s-card s-video s-reveal">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="s-video-link">
                <span className="s-thumb">
                    {item.thumbnail_url && !thumbError
                        ? <img src={item.thumbnail_url} alt="" loading="lazy" onError={() => setThumbError(true)} />
                        : null}
                    <i className="fa-solid fa-play" aria-hidden="true" />
                </span>
                <span className="s-video-text">
                    <h3>{item.title}</h3>
                    {item.source && <span className="p-mono p-dim">{item.source}</span>}
                </span>
            </a>
            <div className="s-card-foot">
                <RelevancePanel analysis={item.analysis} />
                <SaveButton item={item} />
            </div>
        </article>
    );
}

function NewsCard({ item }) {
    return (
        <article className="s-card s-news s-reveal">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="s-web-link">
                <span className="s-news-meta p-mono">
                    {item.source && <b>{item.source}</b>}
                    {item.date && <span className="p-dim">{item.date}</span>}
                </span>
                <h3>{item.title}</h3>
                {item.snippet && <p>{item.snippet}</p>}
                <i className="fa-solid fa-arrow-up-right s-arrow" aria-hidden="true" />
            </a>
            <div className="s-card-foot">
                <RelevancePanel analysis={item.analysis} />
                <SaveButton item={item} />
            </div>
        </article>
    );
}

/* How the system understood the input. */
function Interpretation({ interpretation, summary, confidence, metadata }) {
    if (!interpretation) return null;
    const transcripts = interpretation.transcripts?.length
        ? interpretation.transcripts
        : (interpretation.transcript ? [interpretation.transcript] : []);
    const captions = interpretation.captions?.length
        ? interpretation.captions
        : (interpretation.image_caption ? [interpretation.image_caption] : []);
    const facts = [
        ...transcripts.map(t => ({ label: 'Heard', value: t })),
        ...captions.map(c => ({ label: 'Saw', value: c })),
        { label: 'Searched for', value: interpretation.interpreted_query },
    ];

    return (
        <section className="s-interp" aria-label="How Neuron read your query">
            <div className="s-interp-tags">
                <span className="s-tag p-mono">{interpretation.modality} input</span>
                {interpretation.visual_search && (
                    <span className="s-tag s-tag--accent p-mono"><i className="fa-solid fa-eye" aria-hidden="true" /> Visual match</span>
                )}
                <ConfidenceBadge level={confidence} />
                {metadata?.degraded && (
                    <span className="s-degraded"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Semantic ranking degraded</span>
                )}
                {metadata && (
                    <span className="s-timing p-mono p-dim">{metadata.provider}, {Math.round(metadata.duration_ms)} ms</span>
                )}
            </div>
            <dl className="s-facts">
                {facts.map(({ label, value }, i) => (
                    <div key={`${label}-${i}`}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                    </div>
                ))}
            </dl>
            {summary && <p className="s-summary">{summary}</p>}
            {interpretation.notes?.length > 0 && (
                <ul className="s-notes p-mono">
                    {interpretation.notes.map(n => <li key={n}>{n}</li>)}
                </ul>
            )}
        </section>
    );
}

function Skeleton() {
    return (
        <div className="s-skeleton" aria-busy="true" aria-label="Loading results">
            <div className="s-skel-interp p-skel" />
            <div className="s-skel-tabs">{[1, 2, 3, 4].map(i => <span key={i} className="p-skel" />)}</div>
            {[1, 2, 3].map(i => (
                <div key={i} className="s-skel-card">
                    <span className="p-skel" style={{ width: '24%' }} />
                    <span className="p-skel" style={{ width: '70%', height: 18 }} />
                    <span className="p-skel" style={{ width: '92%' }} />
                    <span className="p-skel" style={{ width: '60%' }} />
                </div>
            ))}
        </div>
    );
}

const TABS = [
    { id: 'all', label: 'All', icon: 'fa-solid fa-layer-group' },
    { id: 'web', label: 'Web', icon: 'fa-solid fa-globe' },
    { id: 'images', label: 'Images', icon: 'fa-regular fa-image' },
    { id: 'videos', label: 'Videos', icon: 'fa-solid fa-film' },
    { id: 'news', label: 'News', icon: 'fa-regular fa-newspaper' },
];

const LIMIT = 5;

export default function Search() {
    const location = useLocation();
    const query = location.state?.query || '';
    const filesMeta = location.state?.files || [];

    const [activeTab, setActiveTab] = useState('all');
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [openImageIndex, setOpenImageIndex] = useState(null);
    const requestKeyRef = useRef(null);
    const resultsRef = useRef(null);

    const fileLabel = filesMeta.length === 1
        ? `[${filesMeta[0].name}]`
        : filesMeta.length > 1 ? `[${filesMeta.length} files]` : '';
    const displayQuery = fileLabel ? `${query ? `${query} ` : ''}${fileLabel}` : query;
    const hasQuery = Boolean(query || filesMeta.length);

    const searchAt = location.state?.at;
    const fileKey = filesMeta.map(f => f.name).join('|');
    useEffect(() => {
        if (!hasQuery) return;
        // One request per distinct search. The key dedupes React StrictMode's
        // double effect-invoke so we don't fire or abort the request twice.
        // No AbortController on purpose: aborting on the StrictMode cleanup
        // killed the only in-flight request.
        const requestKey = JSON.stringify({ query, files: fileKey, at: searchAt });
        if (requestKeyRef.current === requestKey) return;
        requestKeyRef.current = requestKey;

        const files = getPendingFiles();

        setLoading(true);
        setError(null);
        setData(null);
        setActiveTab('all');
        setPage(1);
        setOpenImageIndex(null);

        searchApi({ query, files, page: 1 })
            .then(response => {
                if (requestKeyRef.current !== requestKey) return; // superseded
                setData(response);
                clearPendingFiles();
            })
            .catch(err => {
                if (requestKeyRef.current === requestKey) setError(err.message);
            })
            .finally(() => {
                if (requestKeyRef.current === requestKey) setLoading(false);
            });
    }, [hasQuery, query, fileKey, searchAt]);

    // Fetch the next page and append per category. The interpreted query is
    // resent as text so file inputs aren't re-processed each page.
    async function loadMore() {
        if (loadingMore || !data?.metadata?.has_more) return;
        const nextPage = page + 1;
        const textQuery = data.interpretation?.interpreted_query || query;
        setLoadingMore(true);
        setError(null);
        try {
            const response = await searchApi({ query: textQuery, page: nextPage });
            setData(prev => ({
                ...prev,
                results: {
                    web: [...(prev.results.web ?? []), ...(response.results.web ?? [])],
                    images: [...(prev.results.images ?? []), ...(response.results.images ?? [])],
                    videos: [...(prev.results.videos ?? []), ...(response.results.videos ?? [])],
                    news: [...(prev.results.news ?? []), ...(response.results.news ?? [])],
                },
                metadata: { ...prev.metadata, has_more: response.metadata.has_more },
            }));
            setPage(nextPage);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingMore(false);
        }
    }

    const results = {
        web: data?.results?.web ?? [],
        images: data?.results?.images ?? [],
        videos: data?.results?.videos ?? [],
        news: data?.results?.news ?? [],
    };
    const totalCount = results.web.length + results.images.length + results.videos.length + results.news.length;
    const tabCounts = {
        web: results.web.length, images: results.images.length,
        videos: results.videos.length, news: results.news.length,
    };
    const visibleTabs = TABS.filter(tab => tab.id === 'all' || tabCounts[tab.id] > 0);

    // Results enter in sequence whenever a new set or tab appears.
    useGsap((c) => {
        if (!c.motion || !data) return;
        gsap.from('.s-reveal', { y: 24, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: 0.035, clearProps: 'transform,opacity' });
        gsap.from('.s-interp', { y: 16, opacity: 0, duration: 0.6, ease: 'expo.out' });
    }, resultsRef, [data, activeTab]);

    function renderContent() {
        if (loading) return <Skeleton />;
        if (error && !data) {
            return <p className="p-alert" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {error}</p>;
        }
        if (data && totalCount === 0) {
            return (
                <div className="p-empty">
                    <h3>Nothing came back.</h3>
                    <p>No results for &ldquo;{displayQuery}&rdquo;. Try fewer words, or add an image to describe what you mean.</p>
                </div>
            );
        }
        if (!data) return null;

        const show = activeTab;
        return (
            <div className="s-sections">
                {(show === 'all' || show === 'web') && results.web.length > 0 && (
                    <section>
                        <SectionHeader title="Web" count={results.web.length} />
                        <div className="s-list">
                            {(show === 'all' ? results.web.slice(0, LIMIT) : results.web).map((item, i) => (
                                <WebCard key={`${item.url}-${i}`} item={item} />
                            ))}
                        </div>
                    </section>
                )}

                {(show === 'all' || show === 'images') && results.images.length > 0 && (
                    <section>
                        <SectionHeader title="Images" count={results.images.length} />
                        <div className="s-grid">
                            {(show === 'all' ? results.images.slice(0, LIMIT + 1) : results.images).map((item, i) => (
                                <ImageCard key={`${item.image_url}-${i}`} item={item} onOpen={() => setOpenImageIndex(i)} />
                            ))}
                        </div>
                    </section>
                )}

                {(show === 'all' || show === 'videos') && results.videos.length > 0 && (
                    <section>
                        <SectionHeader title="Videos" count={results.videos.length} />
                        <div className="s-list s-list--2">
                            {(show === 'all' ? results.videos.slice(0, LIMIT) : results.videos).map((item, i) => (
                                <VideoCard key={`${item.url}-${i}`} item={item} />
                            ))}
                        </div>
                    </section>
                )}

                {(show === 'all' || show === 'news') && results.news.length > 0 && (
                    <section>
                        <SectionHeader title="News" count={results.news.length} />
                        <div className="s-list">
                            {(show === 'all' ? results.news.slice(0, LIMIT) : results.news).map((item, i) => (
                                <NewsCard key={`${item.url}-${i}`} item={item} />
                            ))}
                        </div>
                    </section>
                )}

                {error && <p className="p-alert" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {error}</p>}

                {/* On "All" results are a per-category preview; paging happens in a category tab. */}
                {data.metadata?.has_more && (
                    show === 'all' ? (
                        <p className="s-more-hint p-dim">Open a category tab to load more results.</p>
                    ) : (
                        <div className="s-more">
                            <button type="button" className="p-btn p-btn-ghost p-btn-lg" onClick={loadMore} disabled={loadingMore}>
                                {loadingMore
                                    ? <><i className="fa-solid fa-circle-notch p-spin" aria-hidden="true" /> Loading</>
                                    : <>Load page {page + 1} <i className="fa-solid fa-arrow-down" aria-hidden="true" /></>}
                            </button>
                        </div>
                    )
                )}
            </div>
        );
    }

    return (
        <PulseLayout>
            <div className="s-top">
                <div className="p-container">
                    <SearchBar compact initialQuery={query ?? ''} loading={loading} id="results-search" />
                </div>
            </div>

            <div ref={resultsRef} className="p-container s-body">
                {!hasQuery && (
                    <div className="s-start">
                        <h1 className="p-page-title">Search anything.</h1>
                        <p className="p-lede">Type words, attach an image, video or audio clip, or record your voice. Mix them in one query.</p>
                        <ul className="s-start-list">
                            <li><i className="fa-solid fa-plus" aria-hidden="true" /> Attach files with the plus button or drag them onto the bar</li>
                            <li><i className="fa-solid fa-microphone" aria-hidden="true" /> Record a question and use it as text or as an audio input</li>
                            <li><i className="fa-solid fa-magnifying-glass-chart" aria-hidden="true" /> Open &ldquo;Why this result?&rdquo; on any result to see its signals</li>
                        </ul>
                    </div>
                )}

                {hasQuery && (
                    <>
                        <header className="s-head">
                            <h1 className="s-query">
                                <span className="p-mono p-dim">Results for</span>
                                <span className="s-query-text">{displayQuery}</span>
                            </h1>
                            {!loading && data && (
                                <span className="p-mono p-dim">{totalCount} result{totalCount !== 1 ? 's' : ''}</span>
                            )}
                        </header>

                        <div className="s-layout">
                            <div className="s-main">
                                {!loading && totalCount > 0 && (
                                    <div className="s-tabs" role="tablist" aria-label="Result type">
                                        {visibleTabs.map(tab => (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                role="tab"
                                                className="p-chip"
                                                aria-selected={activeTab === tab.id}
                                                onClick={() => setActiveTab(tab.id)}
                                            >
                                                <i className={tab.icon} aria-hidden="true" />
                                                {tab.label}
                                                {tab.id !== 'all' && <span className="p-count">{tabCounts[tab.id]}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {renderContent()}
                            </div>

                            {!loading && data && (
                                <aside className="s-side">
                                    <Interpretation
                                        interpretation={data.interpretation}
                                        summary={data.summary}
                                        confidence={data.overall_confidence}
                                        metadata={data.metadata}
                                    />
                                </aside>
                            )}
                        </div>
                    </>
                )}
            </div>

            <ImageDetailPanel
                item={openImageIndex === null ? null : results.images[openImageIndex] ?? null}
                onClose={() => setOpenImageIndex(null)}
                onPrev={openImageIndex > 0 ? () => setOpenImageIndex(i => i - 1) : undefined}
                onNext={
                    openImageIndex !== null && openImageIndex < results.images.length - 1
                        ? () => setOpenImageIndex(i => i + 1)
                        : undefined
                }
            />
        </PulseLayout>
    );
}
