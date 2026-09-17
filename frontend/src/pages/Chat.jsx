import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PulseLayout from '../components/pulse/PulseLayout';
import DocumentPreview from '../components/DocumentPreview';
import * as chatApi from '../services/chatApi';
import { uploadDocument } from '../services/documentsApi';
import { gsap } from '../hooks/useGsap';
import './chat/chat.css';

const ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.xlsx,.xls,.html,.htm,.xml,.json,.py,.js,.jsx,.ts,.tsx,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.sql,.sh,.yaml,.yml,.toml';
const SUGGESTIONS = ['Summarize the key points', 'List the main findings', 'What are the open questions?'];
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function CitationChip({ citation, onOpen }) {
    const where = citation.location;
    const label = [
        where.document_name,
        where.page_number ? `page ${where.page_number}` : null,
        where.section ? `section ${where.section}` : null,
    ].filter(Boolean).join(', ');
    return (
        <button
            type="button"
            className="c-cite"
            onClick={() => onOpen?.(citation)}
            aria-label={`Open source ${citation.marker}: ${label}`}
            title={`${label}\n\n"${citation.quoted_text}"`}
        >
            {citation.marker}
        </button>
    );
}

function AnswerText({ content, citations, onOpenCitation }) {
    if (!citations?.length) return <span className="c-text">{content}</span>;
    const byMarker = Object.fromEntries(citations.map(c => [c.marker, c]));
    const parts = content.split(/(\[\d{1,2}\])/g);
    return (
        <span className="c-text">
            {parts.map((part, index) => {
                const match = part.match(/^\[(\d{1,2})\]$/);
                if (match && byMarker[Number(match[1])]) {
                    return <CitationChip key={index} citation={byMarker[Number(match[1])]} onOpen={onOpenCitation} />;
                }
                return part;
            })}
        </span>
    );
}

function Message({ message, onOpenCitation }) {
    const isUser = message.role === 'user';
    return (
        <li className={`c-msg ${isUser ? 'c-msg--user' : 'c-msg--bot'}`}>
            <span className="c-who p-mono">{isUser ? 'You' : 'Neuron'}</span>
            <div className="c-bubble">
                <AnswerText content={message.content} citations={message.citations} onOpenCitation={onOpenCitation} />
                {!isUser && (message.citations?.length > 0 || message.confidence > 0) && (
                    <div className="c-meta p-mono">
                        {message.citations?.length > 0 && <span>{message.citations.length} source{message.citations.length > 1 ? 's' : ''}, click a number to open</span>}
                        {message.confidence > 0 && <span>grounding {Math.round(message.confidence * 100)}</span>}
                    </div>
                )}
            </div>
        </li>
    );
}

function Welcome({ scoped, onPick, disabled }) {
    return (
        <div className="c-welcome">
            <h2>Ask {scoped ? 'the selected documents' : 'your documents'}.</h2>
            <p>Answers are grounded in your files. Every number like <span className="c-cite c-cite--static">1</span> opens the exact passage on the right.</p>
            <div className="c-suggest">
                {SUGGESTIONS.map(s => (
                    <button key={s} type="button" className="p-chip" onClick={() => onPick(s)} disabled={disabled}>{s}</button>
                ))}
            </div>
        </div>
    );
}

export default function Chat() {
    const location = useLocation();
    const navigate = useNavigate();
    const scopedDocumentIds = location.state?.documentIds || null;
    const startNew = location.state?.startNew || (scopedDocumentIds?.length > 0);

    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [activeSession, setActiveSession] = useState(null);
    const [question, setQuestion] = useState('');
    const [useWebSearch, setUseWebSearch] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [webResults, setWebResults] = useState(null);
    const [preview, setPreview] = useState(null);   // { documentId, chunkId, documentName }
    const [lastAsked, setLastAsked] = useState('');
    const [railOpen, setRailOpen] = useState(false);
    const [uploadNote, setUploadNote] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [confirmId, setConfirmId] = useState(null);
    const scrollRef = useRef(null);
    const uploadRef = useRef(null);
    const inputRef = useRef(null);
    const bootstrappedRef = useRef(false);

    const refreshSessions = useCallback(async () => {
        const data = await chatApi.listSessions();
        setSessions(data.sessions);
        return data.sessions;
    }, []);

    useEffect(() => {
        if (bootstrappedRef.current) return;
        bootstrappedRef.current = true;
        (async () => {
            try {
                const existing = await refreshSessions();
                if (startNew) {
                    const created = await chatApi.createSession({ documentIds: scopedDocumentIds });
                    await refreshSessions();
                    await openSession(created.id);
                } else if (existing.length > 0) {
                    await openSession(existing[0].id);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setSessionsLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the newest message in view.
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: reduced() ? 'auto' : 'smooth' });
    }, [activeSession?.messages?.length, busy, webResults]);

    // Animate the latest message in.
    const messageCount = activeSession?.messages?.length ?? 0;
    useEffect(() => {
        if (!messageCount || reduced()) return;
        const last = scrollRef.current?.querySelector('.c-msg:last-child');
        if (last) gsap.from(last, { y: 18, opacity: 0, duration: 0.5, ease: 'expo.out', clearProps: 'all' });
    }, [messageCount]);

    async function openSession(sessionId) {
        setError(null);
        setPreview(null);
        setWebResults(null);
        setRailOpen(false);
        const detail = await chatApi.getSession(sessionId);
        setActiveSession(detail);
    }

    async function newSession() {
        setError(null);
        try {
            const created = await chatApi.createSession({});
            await refreshSessions();
            await openSession(created.id);
            inputRef.current?.focus();
        } catch (err) {
            setError(err.message);
        }
    }

    async function removeSession(sessionId) {
        setConfirmId(null);
        try {
            await chatApi.deleteSession(sessionId);
            const remaining = await refreshSessions();
            if (activeSession?.id === sessionId) {
                setActiveSession(null);
                if (remaining.length) await openSession(remaining[0].id);
            }
        } catch (err) {
            setError(err.message);
        }
    }

    function openCitation(citation) {
        const loc = citation.location;
        setPreview({ documentId: loc.document_id, chunkId: loc.chunk_id, documentName: loc.document_name });
    }

    async function handleUpload(files) {
        if (!files?.length) return;
        setUploading(true);
        setUploadNote(null);
        setError(null);
        try {
            const names = [];
            for (const file of files) {
                const doc = await uploadDocument(file);
                names.push(doc.filename);
            }
            const scoped = activeSession?.document_ids?.length > 0;
            setUploadNote(
                `Uploaded ${names.join(', ')}. ${scoped
                    ? 'This chat is limited to specific documents, so start a new conversation to include it.'
                    : 'You can ask about it now.'}`,
            );
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    }

    async function ask(text) {
        const q = text.trim();
        if (!q || busy || !activeSession) return;

        setBusy(true);
        setError(null);
        setWebResults(null);
        setQuestion('');
        setLastAsked(q);
        setActiveSession(prev => ({
            ...prev,
            messages: [...prev.messages, { id: `tmp-${Date.now()}`, role: 'user', content: q }],
        }));

        try {
            const response = await chatApi.ask(activeSession.id, { question: q, useWebSearch });
            setActiveSession(prev => ({ ...prev, messages: [...prev.messages, response.message] }));
            setWebResults(response.web_results);
            refreshSessions();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    const canSend = Boolean(question.trim()) && !busy && Boolean(activeSession);

    return (
        <PulseLayout footer={false} className="c-page">
            <div className="c-shell" data-preview={Boolean(preview)} data-rail={railOpen}>
                {/* Conversations rail */}
                <aside className="c-rail" aria-label="Conversations">
                    <div className="c-rail-head">
                        <b>Conversations</b>
                        <button type="button" className="c-icon-btn c-rail-close" onClick={() => setRailOpen(false)} aria-label="Close conversations">
                            <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="c-rail-actions">
                        <button type="button" className="p-btn p-btn-accent" onClick={newSession}>
                            <i className="fa-solid fa-plus" aria-hidden="true" /> New chat
                        </button>
                        <button type="button" className="p-btn p-btn-ghost" onClick={() => uploadRef.current?.click()} disabled={uploading}>
                            {uploading
                                ? <><i className="fa-solid fa-circle-notch p-spin" aria-hidden="true" /> Uploading</>
                                : <><i className="fa-solid fa-arrow-up-from-bracket" aria-hidden="true" /> Upload</>}
                        </button>
                        <input ref={uploadRef} type="file" multiple hidden accept={ACCEPT}
                            onChange={e => { handleUpload([...e.target.files]); e.target.value = ''; }} />
                    </div>
                    <ul className="c-sessions">
                        {sessionsLoading && [1, 2, 3].map(i => <li key={i} className="c-session-skel p-skel" />)}
                        {!sessionsLoading && sessions.length === 0 && (
                            <li className="p-hint c-none">No conversations yet. Start one with New chat.</li>
                        )}
                        {sessions.map(session => (
                            <li key={session.id} className="c-session" data-active={activeSession?.id === session.id}>
                                <button type="button" className="c-session-open" onClick={() => openSession(session.id)}>
                                    <span className="c-session-title">{session.title}</span>
                                    {session.document_ids?.length > 0 && (
                                        <span className="p-mono p-dim">{session.document_ids.length} document{session.document_ids.length > 1 ? 's' : ''}</span>
                                    )}
                                </button>
                                {confirmId === session.id ? (
                                    <span className="c-confirm">
                                        <button type="button" className="c-yes" onClick={() => removeSession(session.id)}>Delete</button>
                                        <button type="button" className="c-no" onClick={() => setConfirmId(null)}>Keep</button>
                                    </span>
                                ) : (
                                    <button type="button" className="c-icon-btn c-session-del" onClick={() => setConfirmId(session.id)} aria-label={`Delete ${session.title}`}>
                                        <i className="fa-regular fa-trash-can" aria-hidden="true" />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </aside>
                <button type="button" className="c-rail-scrim" tabIndex={-1} aria-hidden="true" onClick={() => setRailOpen(false)} />

                {/* Conversation */}
                <section className="c-main" aria-label="Conversation">
                    <header className="c-head">
                        <button type="button" className="c-icon-btn c-rail-toggle" onClick={() => setRailOpen(true)} aria-label="Show conversations">
                            <i className="fa-solid fa-bars-staggered" aria-hidden="true" />
                        </button>
                        <h1 className="c-title">{activeSession?.title || 'Document chat'}</h1>
                        {activeSession?.document_ids?.length > 0 && (
                            <span className="p-mono p-dim">Limited to {activeSession.document_ids.length} document{activeSession.document_ids.length > 1 ? 's' : ''}</span>
                        )}
                    </header>

                    <div ref={scrollRef} className="c-scroll">
                        {uploadNote && (
                            <p className="p-note c-note" role="status">
                                <i className="fa-solid fa-check" aria-hidden="true" style={{ color: 'var(--p-high)' }} />
                                <span>{uploadNote}</span>
                                <button type="button" className="c-icon-btn" onClick={() => setUploadNote(null)} aria-label="Dismiss">
                                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                                </button>
                            </p>
                        )}

                        {!activeSession || activeSession.messages.length === 0 ? (
                            sessionsLoading
                                ? <div className="c-welcome"><span className="p-skel" style={{ height: 48, width: '60%' }} /></div>
                                : <Welcome
                                    scoped={activeSession?.document_ids?.length > 0}
                                    disabled={!activeSession || busy}
                                    onPick={(s) => (activeSession ? ask(s) : undefined)}
                                />
                        ) : (
                            <ol className="c-thread">
                                {activeSession.messages.map(message => (
                                    <Message key={message.id} message={message} onOpenCitation={openCitation} />
                                ))}
                            </ol>
                        )}

                        {!activeSession && !sessionsLoading && (
                            <div className="c-center">
                                <button type="button" className="p-btn p-btn-accent p-btn-lg" onClick={newSession}>Start a conversation</button>
                            </div>
                        )}

                        {busy && (
                            <div className="c-thinking" aria-live="polite">
                                <span className="c-dots" aria-hidden="true"><i /><i /><i /></span>
                                <span className="p-mono p-dim">Reading your documents</span>
                            </div>
                        )}

                        {webResults?.length > 0 && (
                            <section className="c-web" aria-label="Web resources">
                                <div className="c-web-head">
                                    <b><i className="fa-solid fa-globe" aria-hidden="true" /> From the web</b>
                                    <button
                                        type="button"
                                        className="p-btn p-btn-ghost"
                                        onClick={() => navigate('/search', { state: { query: lastAsked, at: Date.now() } })}
                                    >
                                        Open full search <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                                    </button>
                                </div>
                                <ol className="c-web-list">
                                    {webResults.map((result, index) => (
                                        <li key={index}>
                                            <a href={result.url} target="_blank" rel="noopener noreferrer">
                                                <span className="c-web-rank p-mono">{result.rank ?? index + 1}</span>
                                                <span className="c-web-body">
                                                    <b>{result.title}</b>
                                                    <span className="p-mono p-dim">
                                                        {result.source}
                                                        {typeof result.relevance === 'number' && `, ${Math.round(result.relevance * 100)} match`}
                                                    </span>
                                                    {result.snippet && <span className="c-web-snip">{result.snippet}</span>}
                                                </span>
                                            </a>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        )}

                        {error && <p className="p-alert" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {error}</p>}
                    </div>

                    <form className="c-composer" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
                        <div className="c-compose-row">
                            <label htmlFor="chat-question" className="p-sr-only">Ask a question</label>
                            <textarea
                                ref={inputRef}
                                id="chat-question"
                                className="c-input"
                                rows={1}
                                value={question}
                                onChange={e => setQuestion(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(question); } }}
                                placeholder={activeSession ? 'Ask about your documents' : 'Start a conversation to ask a question'}
                                disabled={!activeSession || busy}
                            />
                            <button type="submit" className="c-send" disabled={!canSend} aria-label="Send question">
                                <i className="fa-solid fa-arrow-up" aria-hidden="true" />
                            </button>
                        </div>
                        <label className="c-web-toggle">
                            <input type="checkbox" checked={useWebSearch} onChange={e => setUseWebSearch(e.target.checked)} />
                            <span className="c-switch" aria-hidden="true" />
                            Add live web results when my documents don&rsquo;t cover it
                        </label>
                    </form>
                </section>

                {/* Source preview */}
                {preview && (
                    <aside className="c-preview" aria-label="Source preview">
                        <DocumentPreview
                            documentId={preview.documentId}
                            documentName={preview.documentName}
                            targetChunkId={preview.chunkId}
                            onClose={() => setPreview(null)}
                        />
                    </aside>
                )}
            </div>
        </PulseLayout>
    );
}
