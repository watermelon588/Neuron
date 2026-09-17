import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PulseLayout from '../components/pulse/PulseLayout';
import DocumentPreview from '../components/DocumentPreview';
import * as documentsApi from '../services/documentsApi';
import { gsap, useGsap } from '../hooks/useGsap';
import './documents/documents.css';

const FORMAT_ICONS = {
    pdf: 'fa-regular fa-file-pdf', docx: 'fa-regular fa-file-word', txt: 'fa-regular fa-file-lines',
    md: 'fa-brands fa-markdown', csv: 'fa-solid fa-file-csv', tsv: 'fa-solid fa-file-csv',
    xlsx: 'fa-regular fa-file-excel', xls: 'fa-regular fa-file-excel', html: 'fa-solid fa-code',
    htm: 'fa-solid fa-code', xml: 'fa-solid fa-code', json: 'fa-solid fa-code', code: 'fa-regular fa-file-code',
};

const ACCEPT = '.pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.xlsx,.xls,.html,.htm,.xml,.json,.py,.js,.jsx,.ts,.tsx,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.sql,.sh,.yaml,.yml,.toml';

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Documents() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(null);   // { current, total, name }
    const [error, setError] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [viewDoc, setViewDoc] = useState(null);       // { documentId, documentName }
    const [confirmId, setConfirmId] = useState(null);
    const fileInputRef = useRef(null);
    const rootRef = useRef(null);

    const refresh = useCallback(async () => {
        try {
            const data = await documentsApi.listDocuments();
            setDocuments(data.documents);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    // Close the viewer with Escape.
    useEffect(() => {
        if (!viewDoc) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setViewDoc(null); };
        window.addEventListener('keydown', onKey);
        document.documentElement.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.documentElement.style.overflow = '';
        };
    }, [viewDoc]);

    async function handleUpload(files) {
        if (!files?.length) return;
        setError(null);
        try {
            for (let i = 0; i < files.length; i += 1) {
                setUploading({ current: i + 1, total: files.length, name: files[i].name });
                await documentsApi.uploadDocument(files[i]);
            }
            await refresh();
        } catch (err) {
            setError(err.message);
            await refresh(); // earlier files in the batch may have succeeded
        } finally {
            setUploading(null);
        }
    }

    async function handleDelete(documentId) {
        setError(null);
        setConfirmId(null);
        try {
            await documentsApi.deleteDocument(documentId);
            setSelected(prev => { const next = new Set(prev); next.delete(documentId); return next; });
            await refresh();
        } catch (err) {
            setError(err.message);
        }
    }

    function toggleSelect(documentId) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(documentId)) next.delete(documentId);
            else next.add(documentId);
            return next;
        });
    }

    function startChat() {
        navigate('/chat', { state: { documentIds: [...selected], startNew: true } });
    }

    const readyCount = documents.filter(d => d.status === 'ready').length;

    useGsap((c) => {
        if (!c.motion) return;
        gsap.from('.p-page-title .p-title-mask > span', { yPercent: 100, fontStretch: '62%', duration: 1.1, ease: 'expo.out' });
        gsap.from('.d-head .p-lede, .d-drop', { y: 24, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.08, delay: 0.15 });
    }, rootRef);

    useGsap((c) => {
        if (!c.motion || loading) return;
        gsap.from('.d-row', { y: 18, opacity: 0, duration: 0.5, ease: 'expo.out', stagger: 0.04, clearProps: 'transform,opacity' });
    }, rootRef, [loading, documents.length]);

    return (
        <PulseLayout>
            <div ref={rootRef} className="p-container d-wrap">
                <header className="d-head p-page-head">
                    <h1 className="p-page-title"><span className="p-title-mask"><span style={{ display: 'inline-block' }}>Your documents.</span></span></h1>
                    <p className="p-lede">Upload PDFs, Word files, spreadsheets, Markdown or code, then ask them questions.</p>
                </header>

                <div
                    className="d-drop"
                    data-dragging={dragging}
                    data-busy={Boolean(uploading)}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
                    onDrop={e => { e.preventDefault(); setDragging(false); if (!uploading) handleUpload([...e.dataTransfer.files]); }}
                >
                    <input
                        ref={fileInputRef} id="doc-upload" type="file" multiple hidden accept={ACCEPT}
                        onChange={e => { handleUpload([...e.target.files]); e.target.value = ''; }}
                    />
                    <div className="d-drop-icon" aria-hidden="true">
                        <i className={uploading ? 'fa-solid fa-circle-notch p-spin' : 'fa-solid fa-arrow-up-from-bracket'} />
                    </div>
                    <div className="d-drop-text" aria-live="polite">
                        <b>
                            {uploading
                                ? `Indexing ${uploading.name}`
                                : dragging ? 'Drop to upload' : 'Drag files here'}
                        </b>
                        <span className="p-mono p-dim">
                            {uploading
                                ? `File ${uploading.current} of ${uploading.total}. Parsing, chunking and embedding.`
                                : 'PDF, DOCX, TXT, MD, CSV, Excel, HTML, XML, JSON, source code'}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="p-btn p-btn-accent p-btn-lg"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={Boolean(uploading)}
                    >
                        Choose files
                    </button>
                </div>

                {error && <p className="p-alert d-error" role="alert"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {error}</p>}

                {readyCount > 0 && (
                    <div className="d-bar">
                        <p>
                            {selected.size > 0
                                ? <><b className="p-mono p-accent-text">{selected.size}</b> selected for chat</>
                                : 'Select documents to scope a chat, or chat across all of them.'}
                        </p>
                        <div className="d-bar-actions">
                            {selected.size > 0 && (
                                <button type="button" className="p-btn p-btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
                            )}
                            <button type="button" className="p-btn p-btn-accent" onClick={startChat}>
                                <i className="fa-regular fa-comments" aria-hidden="true" />
                                Chat with {selected.size > 0 ? 'selection' : 'all'}
                            </button>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="d-list" aria-busy="true" aria-label="Loading documents">
                        {[1, 2, 3].map(i => <div key={i} className="d-row d-row--skel"><span className="p-skel" /><span className="p-skel" /></div>)}
                    </div>
                ) : documents.length === 0 ? (
                    <div className="p-empty">
                        <h3>No documents yet.</h3>
                        <p>Upload a file above. Once it shows Ready, you can view its chunks or start a chat with it.</p>
                    </div>
                ) : (
                    <ul className="d-list">
                        {documents.map(doc => {
                            const isSelected = selected.has(doc.id);
                            const ready = doc.status === 'ready';
                            return (
                                <li key={doc.id} className="d-row" data-selected={isSelected}>
                                    <label className="d-check" data-disabled={!ready}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={!ready}
                                            onChange={() => toggleSelect(doc.id)}
                                            aria-label={`Select ${doc.filename} for chat`}
                                        />
                                        <span aria-hidden="true"><i className="fa-solid fa-check" /></span>
                                    </label>
                                    <i className={`${FORMAT_ICONS[doc.format] || 'fa-regular fa-file'} d-icon`} aria-hidden="true" />
                                    <div className="d-info">
                                        <b title={doc.filename}>{doc.filename}</b>
                                        <span className="p-mono p-dim">
                                            {formatBytes(doc.size_bytes)}
                                            {doc.page_count ? `, ${doc.page_count} pages` : ''}
                                            {doc.chunk_count ? `, ${doc.chunk_count} chunks` : ''}
                                        </span>
                                        {doc.error && <span className="d-doc-error">{doc.error}</span>}
                                    </div>
                                    <span className="d-status p-mono" data-status={doc.status}>{doc.status}</span>
                                    <div className="d-actions">
                                        {ready && (
                                            <button
                                                type="button"
                                                className="p-btn p-btn-ghost"
                                                onClick={() => setViewDoc({ documentId: doc.id, documentName: doc.filename })}
                                            >
                                                View
                                            </button>
                                        )}
                                        {confirmId === doc.id ? (
                                            <span className="d-confirm">
                                                <button type="button" className="p-btn d-danger" onClick={() => handleDelete(doc.id)}>Delete</button>
                                                <button type="button" className="p-btn p-btn-ghost" onClick={() => setConfirmId(null)}>Keep</button>
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                className="d-del"
                                                onClick={() => setConfirmId(doc.id)}
                                                aria-label={`Delete ${doc.filename}`}
                                                title="Delete document"
                                            >
                                                <i className="fa-regular fa-trash-can" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {viewDoc && (
                <div className="d-modal" role="dialog" aria-modal="true" aria-label={`Preview of ${viewDoc.documentName}`} onClick={() => setViewDoc(null)}>
                    <div className="d-modal-card" onClick={e => e.stopPropagation()}>
                        <DocumentPreview
                            documentId={viewDoc.documentId}
                            documentName={viewDoc.documentName}
                            onClose={() => setViewDoc(null)}
                        />
                    </div>
                </div>
            )}
        </PulseLayout>
    );
}
