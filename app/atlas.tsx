'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  imageUrl,
  norm,
  stage,
  upload,
  type Filter,
  type GroupBy,
  type Occurrence,
  type SearchResult,
  type Study,
  type Tag,
  type Thought,
} from './analysis-api';
import {
  cleanFilter,
  FilterEditor,
  Icon,
  SuggestedInput,
  TagChip,
  TagEditor,
} from './analysis-controls';

const emptyFilter: Filter = { type: 'group', join: 'and', children: [] };
const emptyResult: SearchResult = {
  items: [],
  groups: [],
  total: 0,
  page: 1,
  pageSize: 24,
  counts: { occurrences: 0, images: 0, tradingDays: 0 },
};
type Draft = {
  id?: string;
  name: string;
  description: string;
  studyId: string;
  title: string;
  date: string;
  notes: string;
  tags: Tag[];
  files: File[];
  stages: string[];
};
const blankDraft = (): Draft => ({
  name: '',
  description: '',
  studyId: '',
  title: '',
  date: '',
  notes: '',
  tags: [],
  files: [],
  stages: [],
});

export default function Atlas() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [studyId, setStudyId] = useState('all');
  const [text, setText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filter, setFilter] = useState<Filter>(emptyFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy[]>([{ type: 'study' }]);
  const [groupPath, setGroupPath] = useState<(string | null)[] | undefined>();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResult>(emptyResult);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [viewing, setViewing] = useState<Occurrence | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [hiddenKeys, setHiddenKeys] = useState('outcome,final day type');
  const [thought, setThought] = useState('');
  const [editingImage, setEditingImage] = useState(false);
  const [imageTags, setImageTags] = useState<Tag[]>([]);
  const [imageTime, setImageTime] = useState('');
  const [modal, setModal] = useState<'study' | 'occurrence' | 'append' | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [progress, setProgress] = useState<number | null>(null);
  const [modalError, setModalError] = useState('');
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const query = useMemo(
    () => ({
      studyIds: studyId === 'all' ? [] : [studyId],
      text,
      dateFrom,
      dateTo,
      filter: cleanFilter(filter),
      groupBy,
      groupPath,
      page,
      pageSize: 24,
    }),
    [studyId, text, dateFrom, dateTo, filter, groupBy, groupPath, page]
  );

  useEffect(() => {
    const controller = new AbortController();
    api<Study[]>('/studies', 'GET', undefined, controller.signal)
      .then(setStudies)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (query.groupBy.some((group) => group.type === 'tag' && !group.key.trim())) {
        setResult(emptyResult);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      api<SearchResult>('/occurrences/search', 'POST', query, controller.signal)
        .then((next) => {
          setResult(next);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setError(err.message);
            setLoading(false);
          }
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, revision]);
  const image = viewing?.images?.[imageIndex];
  function resetSelection() {
    setPage(1);
    setGroupPath(undefined);
    setViewing(null);
  }
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    await act(async () => {
      const occurrence = await api<Occurrence>(`/occurrences/${id}`);
      setViewing(occurrence);
      setImageIndex(0);
      setRevealed(false);
      setEditingImage(false);
      setThought('');
    });
  }
  async function stepOccurrence(step: number) {
    if (!viewing) return;
    const index = result.items.findIndex((item) => item.id === viewing.id);
    const target = result.items[index + step];
    if (target) {
      await open(target.id);
      return;
    }
    const nextPage = page + step;
    if (nextPage < 1 || nextPage > Math.ceil(result.total / result.pageSize)) return;
    await act(async () => {
      const next = await api<SearchResult>('/occurrences/search', 'POST', {
        ...query,
        page: nextPage,
      });
      const item = step > 0 ? next.items[0] : next.items.at(-1);
      if (!item) return;
      const detail = await api<Occurrence>(`/occurrences/${item.id}`);
      setPage(nextPage);
      setResult(next);
      setViewing(detail);
      setImageIndex(0);
      setRevealed(false);
      setThought('');
      setEditingImage(false);
    });
  }
  function startStudy(edit?: Study) {
    setDraft({
      ...blankDraft(),
      id: edit?.id,
      name: edit?.name ?? '',
      description: edit?.description ?? '',
      tags: edit?.tags ?? [],
    });
    setModalError('');
    setModal('study');
  }
  function startOccurrence(edit?: Occurrence) {
    setDraft({
      ...blankDraft(),
      id: edit?.id,
      studyId: edit?.studyId ?? (studyId === 'all' ? (studies[0]?.id ?? '') : studyId),
      title: edit?.title ?? '',
      date: edit?.date ?? '',
      notes: edit?.notes ?? '',
      tags: edit?.tags ?? [],
    });
    setModalError('');
    setModal('occurrence');
  }
  async function submit() {
    setBusy(true);
    setModalError('');
    try {
      if (modal === 'study') {
        const saved = await api<Study>(
          draft.id ? `/studies/${draft.id}` : '/studies',
          draft.id ? 'PATCH' : 'POST',
          { name: draft.name, description: draft.description, tags: draft.tags }
        );
        setStudyId(saved.id);
        resetSelection();
      } else {
        let saved: Occurrence;
        if (modal === 'occurrence' && draft.id)
          saved = await api<Occurrence>(`/occurrences/${draft.id}`, 'PATCH', {
            studyId: draft.studyId,
            title: draft.title,
            date: draft.date || null,
            notes: draft.notes,
            tags: draft.tags,
          });
        else {
          setProgress(0);
          saved = await upload(
            modal === 'append' ? `/occurrences/${viewing!.id}/images` : '/occurrences',
            {
              studyId: draft.studyId,
              title: draft.title,
              date: draft.date || null,
              notes: draft.notes,
              tags: draft.tags,
              images: draft.files.map((_, i) => ({
                tags: draft.stages[i]?.trim()
                  ? [{ key: 'stage', value: draft.stages[i].trim() }]
                  : [],
              })),
            },
            draft.files,
            setProgress
          );
        }
        setViewing(saved);
        setImageIndex(0);
        setStudyId(saved.studyId);
        setGroupBy([]);
        setGroupPath(undefined);
        setRevealed(false);
        setEditingImage(false);
        setPage(1);
      }
      setModal(null);
      refresh();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Unable to save');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  async function remove(kind: 'studies' | 'occurrences' | 'images', id: string) {
    if (
      !confirm(
        `Delete this ${kind === 'studies' ? 'study and all its occurrences and images' : kind === 'occurrences' ? 'occurrence and all its images' : 'image'}? This cannot be undone.`
      )
    )
      return;
    await act(async () => {
      await api(`/${kind}/${id}`, 'DELETE');
      if (kind === 'studies') {
        setStudyId('all');
        resetSelection();
      } else if (kind === 'occurrences') setViewing(null);
      else if (viewing) {
        setViewing(await api(`/occurrences/${viewing.id}`));
        setImageIndex(0);
      }
    });
  }
  async function moveImage(step: number) {
    if (!viewing?.images) return;
    const ids = viewing.images.map((item) => item.id);
    const target = imageIndex + step;
    if (target < 0 || target >= ids.length) return;
    [ids[imageIndex], ids[target]] = [ids[target], ids[imageIndex]];
    await act(async () => {
      setViewing(await api(`/occurrences/${viewing.id}/image-order`, 'PUT', { imageIds: ids }));
      setImageIndex(target);
    });
  }
  const concealed = (tag: Tag) =>
    !revealed && hiddenKeys.split(',').map(norm).includes(norm(tag.key));
  const activeStudy = studies.find((study) => study.id === studyId);
  const pathLabel = (path: (string | null)[]) =>
    path
      .map((value, index) =>
        value === null
          ? 'Unspecified'
          : groupBy[index]?.type === 'study'
            ? (studies.find((study) => study.id === value)?.name ?? value)
            : value
      )
      .join(' / ');
  const maxPage = Math.max(1, Math.ceil(result.total / result.pageSize));
  const changeDraft = (values: Partial<Draft>) => setDraft((old) => ({ ...old, ...values }));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div>
            <strong>Chart Atlas</strong>
            <small>Pattern study workspace</small>
          </div>
        </div>
        <div className="side-label">WORKSPACE</div>
        <button
          className={`side-item ${studyId === 'all' ? 'active' : ''}`}
          onClick={() => {
            setStudyId('all');
            resetSelection();
          }}
        >
          <Icon name="grid" />
          <span>All occurrences</span>
          <em>{studies.reduce((sum, study) => sum + study.occurrenceCount, 0)}</em>
        </button>
        <div className="side-label side-label-spaced">
          YOUR STUDIES{' '}
          <button onClick={() => startStudy()} aria-label="New study">
            <Icon name="plus" size={15} />
          </button>
        </div>
        {studies.map((study, index) => (
          <button
            key={study.id}
            className={`side-item ${studyId === study.id ? 'active' : ''}`}
            onClick={() => {
              setStudyId(study.id);
              resetSelection();
            }}
          >
            <span className={`study-dot dot-${index % 3}`} />
            <span>
              {study.name}
              <small>
                {study.tags.find((tag) => norm(tag.key) === 'instrument')?.value || 'Study'}
              </small>
            </span>
            <em>{study.occurrenceCount}</em>
          </button>
        ))}
        <button className="side-create" onClick={() => startStudy()}>
          <Icon name="plus" size={16} /> New study
        </button>
        <div className="side-bottom">
          <div className="side-tip">
            <Icon name="layers" />
            <strong>Learn from the sequence</strong>
            <p>Compare conditions, record your thoughts, and follow each example as it unfolds.</p>
          </div>
          <div className="prototype">
            <span /> Your chart study workspace
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <Icon name="right" size={14} />
            <strong>{activeStudy?.name || 'All occurrences'}</strong>
          </div>
          <div className="topbar-right">
            <span>A place to study the market, one chart at a time</span>
            <button
              className="primary"
              disabled={!studies.length || busy}
              onClick={() => startOccurrence()}
            >
              <Icon name="plus" size={17} /> Add occurrence
            </button>
          </div>
        </header>
        <div className="mobile-studies">
          <select
            aria-label="Select study"
            value={studyId}
            onChange={(event) => {
              setStudyId(event.target.value);
              resetSelection();
            }}
          >
            <option value="all">All occurrences</option>
            {studies.map((study) => (
              <option key={study.id} value={study.id}>
                {study.name}
              </option>
            ))}
          </select>
          <button className="secondary" onClick={() => startStudy()}>
            New study
          </button>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={refresh}>Retry</button>
            <button aria-label="Dismiss error" onClick={() => setError('')}>
              ×
            </button>
          </div>
        )}
        {viewing && image ? (
          <div className="review">
            <button className="back" onClick={() => setViewing(null)}>
              <Icon name="left" size={16} /> Back to results
            </button>
            <div className="review-heading">
              <div>
                <div className="eyebrow">
                  {viewing.study.name} · {viewing.date || 'Undated'}
                </div>
                <h1>{viewing.title}</h1>
                {revealed && <p>{viewing.notes}</p>}
              </div>
              <div className="review-buttons">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => startOccurrence(viewing)}
                >
                  Edit occurrence
                </button>
                <button
                  className="secondary"
                  disabled={busy || (page === 1 && result.items[0]?.id === viewing.id)}
                  onClick={() => stepOccurrence(-1)}
                  aria-label="Previous occurrence"
                >
                  <Icon name="left" />
                </button>
                <button
                  className="secondary"
                  disabled={busy || (page === maxPage && result.items.at(-1)?.id === viewing.id)}
                  onClick={() => stepOccurrence(1)}
                  aria-label="Next occurrence"
                >
                  <Icon name="right" />
                </button>
              </div>
            </div>
            <div className="review-columns">
              <div className="review-center">
                <div className="chart-top">
                  <div>
                    <span className="stage">{stage(image)}</span>
                    <span>
                      Image {imageIndex + 1} of {viewing.images!.length}
                      {image.time ? ` · ${image.time.slice(0, 5)}` : ''}
                    </span>
                  </div>
                  <a href={imageUrl(image.url)} target="_blank" rel="noreferrer">
                    Open full image
                  </a>
                </div>
                <div className="large-chart">
                  <img src={imageUrl(image.url)} alt={`${viewing.title}: ${stage(image)}`} />
                </div>
                <div className="chart-nav">
                  <button
                    disabled={imageIndex === 0}
                    onClick={() => {
                      setImageIndex(imageIndex - 1);
                      setEditingImage(false);
                    }}
                  >
                    <Icon name="left" size={17} /> Previous image
                  </button>
                  <div className="dots">
                    {viewing.images!.map((item, index) => (
                      <button
                        key={item.id}
                        className={index === imageIndex ? 'on' : ''}
                        onClick={() => {
                          setImageIndex(index);
                          setEditingImage(false);
                        }}
                        aria-label={`View image ${index + 1}`}
                      />
                    ))}
                  </div>
                  <button
                    disabled={imageIndex === viewing.images!.length - 1}
                    onClick={() => {
                      setImageIndex(imageIndex + 1);
                      setEditingImage(false);
                    }}
                  >
                    Next image <Icon name="right" size={17} />
                  </button>
                </div>
                <div className="timeline">
                  <div className="timeline-head">
                    <strong>Occurrence timeline</strong>
                    <button
                      className="secondary"
                      onClick={() => {
                        setDraft(blankDraft());
                        setModalError('');
                        setModal('append');
                      }}
                    >
                      Add images
                    </button>
                  </div>
                  <div className="timeline-list">
                    {viewing.images!.map((item, index) => (
                      <button
                        className={index === imageIndex ? 'selected' : ''}
                        onClick={() => {
                          setImageIndex(index);
                          setEditingImage(false);
                        }}
                        key={item.id}
                      >
                        <b>{String(index + 1).padStart(2, '0')}</b>
                        <span>
                          {stage(item)}
                          <small>{item.time?.slice(0, 5) || item.originalName}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="image-tools">
                    <button
                      className="secondary"
                      disabled={busy || imageIndex === 0}
                      onClick={() => moveImage(-1)}
                    >
                      Move earlier
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || imageIndex === viewing.images!.length - 1}
                      onClick={() => moveImage(1)}
                    >
                      Move later
                    </button>
                    <button
                      className="danger-link"
                      disabled={busy || viewing.images!.length === 1}
                      onClick={() => remove('images', image.id)}
                    >
                      Delete image
                    </button>
                  </div>
                </div>
              </div>
              <aside className="review-side">
                <div className="detail-panel">
                  <div className="detail-title">
                    <strong>Tags & context</strong>
                    <Icon name="layers" size={16} />
                  </div>
                  <div className="tag-level">
                    <small>STUDY</small>
                    <div>
                      {viewing.study.tags
                        .filter((tag) => !concealed(tag))
                        .map((tag, index) => (
                          <TagChip tag={tag} key={index} />
                        ))}
                    </div>
                  </div>
                  <div className="tag-level">
                    <small>OCCURRENCE</small>
                    <div>
                      {viewing.tags
                        .filter((tag) => !concealed(tag))
                        .map((tag, index) => (
                          <TagChip tag={tag} key={index} />
                        ))}
                      {viewing.tags.some(concealed) && (
                        <span className="concealed">Final labels hidden</span>
                      )}
                    </div>
                  </div>
                  <div className="tag-level">
                    <small>THIS IMAGE</small>
                    <div>
                      {image.tags
                        .filter((tag) => !concealed(tag))
                        .map((tag, index) => (
                          <TagChip tag={tag} key={index} />
                        ))}
                    </div>
                    <button
                      className="edit-tags"
                      onClick={() => {
                        setImageTags(image.tags);
                        setImageTime(image.time?.slice(0, 5) || '');
                        setEditingImage(!editingImage);
                      }}
                    >
                      {editingImage ? 'Cancel editing' : 'Edit image tags & time'}
                    </button>
                    {editingImage && (
                      <div className="image-editor">
                        <label>
                          Observed time
                          <input
                            type="time"
                            value={imageTime}
                            onChange={(event) => setImageTime(event.target.value)}
                          />
                        </label>
                        <TagEditor tags={imageTags} onChange={setImageTags} />
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            act(async () => {
                              setViewing(
                                await api(`/images/${image.id}`, 'PATCH', {
                                  tags: imageTags,
                                  time: imageTime || null,
                                })
                              );
                              setEditingImage(false);
                            })
                          }
                        >
                          Save image
                        </button>
                      </div>
                    )}
                  </div>
                  <label className="conceal-control">
                    Tag keys to conceal (comma separated)
                    <input
                      value={hiddenKeys}
                      onChange={(event) => setHiddenKeys(event.target.value)}
                    />
                  </label>
                  <button className="reveal" onClick={() => setRevealed(!revealed)}>
                    <Icon name="eye" size={17} />{' '}
                    {revealed ? 'Hide final labels & notes' : 'Reveal final labels & notes'}
                  </button>
                </div>
                <div className="detail-panel thought-panel">
                  <div className="detail-title">
                    <strong>What do you expect next?</strong>
                    <Icon name="eye" size={16} />
                  </div>
                  <p>
                    Record a thought before advancing. Your saved thoughts keep their original image
                    context.
                  </p>
                  <textarea
                    value={thought}
                    onChange={(event) => setThought(event.target.value)}
                    placeholder="What signs would make you wait, continue, or reverse?"
                  />
                  <button
                    className="secondary"
                    disabled={busy || !thought.trim()}
                    onClick={() =>
                      act(async () => {
                        const thoughts = await api<Thought[]>(
                          `/occurrences/${viewing.id}/thoughts`,
                          'POST',
                          { imageId: image.id, text: thought }
                        );
                        setViewing({ ...viewing, thoughts });
                        setThought('');
                      })
                    }
                  >
                    Save thought
                  </button>
                  {viewing.thoughts?.map((item) => (
                    <div className="saved-thought" key={item.id}>
                      <strong>{item.stageSnapshot}</strong>
                      <small>{new Date(item.createdAt).toLocaleString()}</small>
                      <p>{item.text}</p>
                    </div>
                  ))}
                </div>
                <button
                  className="danger-link"
                  disabled={busy}
                  onClick={() => remove('occurrences', viewing.id)}
                >
                  Delete occurrence
                </button>
              </aside>
            </div>
          </div>
        ) : (
          <div className="browse">
            <div className="page-hero">
              <div className="eyebrow">
                CHART JOURNAL <span className="eyebrow-rule" />
              </div>
              <div className="hero-line">
                <div>
                  <h1>{activeStudy?.name || 'Explore your occurrences'}</h1>
                  <p>
                    {activeStudy?.description ||
                      'Collect patterns, compare conditions, and study how each setup unfolds.'}
                  </p>
                </div>
                <div className="hero-count">
                  <strong>{result.counts.occurrences}</strong>
                  <span>occurrences in view</span>
                </div>
              </div>
              {activeStudy && (
                <div className="study-tools">
                  <div>
                    {activeStudy.tags.map((tag, index) => (
                      <TagChip tag={tag} key={index} />
                    ))}
                  </div>
                  <button className="secondary" onClick={() => startStudy(activeStudy)}>
                    Edit study
                  </button>
                  <button
                    className="danger-link"
                    disabled={busy}
                    onClick={() => remove('studies', activeStudy.id)}
                  >
                    Delete study
                  </button>
                </div>
              )}
            </div>
            <div className="stats">
              <div>
                <span className="stat-icon green">
                  <Icon name="layers" />
                </span>
                <strong>{studies.length}</strong>
                <small>Active studies</small>
              </div>
              <div>
                <span className="stat-icon gold">
                  <Icon name="image" />
                </span>
                <strong>{result.counts.images}</strong>
                <small>Chart images in view</small>
              </div>
              <div>
                <span className="stat-icon purple">
                  <Icon name="calendar" />
                </span>
                <strong>{result.counts.tradingDays}</strong>
                <small>Unique chart dates in view</small>
              </div>
            </div>
            <div className="library-head">
              <h2>Occurrence library</h2>
              <p>Search across studies and instruments, then review each example in sequence.</p>
            </div>
            <div className="control-bar">
              <label className="search">
                <Icon name="search" />
                <input
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    resetSelection();
                  }}
                  placeholder="Search titles, notes, tags, or dates..."
                />
              </label>
              <label className="date-filter">
                From
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    resetSelection();
                  }}
                />
              </label>
              <label className="date-filter">
                To
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    resetSelection();
                  }}
                />
              </label>
              <button
                className={`filter-button ${filterOpen ? 'selected' : ''}`}
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <Icon name="filter" size={17} /> Filters
              </button>
            </div>
            <div className="group-builder">
              <strong>Group by</strong>
              {groupBy.map((group, index) => (
                <div className="group-level" key={index}>
                  <span>{index + 1}</span>
                  <select
                    aria-label={`Grouping level ${index + 1}`}
                    value={group.type === 'tag' ? `tag:${group.scope}` : group.type}
                    onChange={(event) => {
                      const value = event.target.value;
                      const next: GroupBy = value.startsWith('tag:')
                        ? { type: 'tag', scope: value.slice(4) as 'study', key: '' }
                        : { type: value as 'study' };
                      setGroupBy(groupBy.map((old, i) => (i === index ? next : old)));
                      resetSelection();
                    }}
                  >
                    <option value="study">Study</option>
                    <option value="date">Chart date</option>
                    <option value="month">Month</option>
                    <option value="tag:study">Study tag</option>
                    <option value="tag:occurrence">Occurrence tag</option>
                    <option value="tag:image">Image tag</option>
                  </select>
                  {group.type === 'tag' && (
                    <SuggestedInput
                      value={group.key}
                      onChange={(key) => {
                        setGroupBy(
                          groupBy.map((old, i) => (i === index ? { ...group, key } : old))
                        );
                        resetSelection();
                      }}
                      placeholder="Grouping tag key"
                    />
                  )}
                  <button
                    className="icon-btn"
                    aria-label={`Remove grouping level ${index + 1}`}
                    onClick={() => {
                      setGroupBy(groupBy.filter((_, i) => i !== index));
                      resetSelection();
                    }}
                  >
                    <Icon name="close" size={13} />
                  </button>
                </div>
              ))}
              <button
                className="edit-tags"
                disabled={groupBy.length >= 5}
                onClick={() => {
                  setGroupBy([...groupBy, { type: 'date' }]);
                  resetSelection();
                }}
              >
                + Grouping level
              </button>
            </div>
            {filterOpen && (
              <div className="filter-panel">
                <div className="filter-head">
                  <div>
                    <strong>Build a filter</strong>
                    <span>Combine scopes, nested AND/OR, NOT, and same-image conditions.</span>
                  </div>
                  <button
                    onClick={() => {
                      setFilter(emptyFilter);
                      resetSelection();
                    }}
                  >
                    Clear all
                  </button>
                </div>
                <FilterEditor
                  filter={filter}
                  onChange={(next) => {
                    setFilter(next);
                    resetSelection();
                  }}
                />
              </div>
            )}
            {groupPath && (
              <div className="group-breadcrumb">
                <button
                  className="back"
                  onClick={() => {
                    setGroupPath(undefined);
                    setPage(1);
                  }}
                >
                  ← All groups
                </button>
                <strong>{pathLabel(groupPath)}</strong>
              </div>
            )}
            {loading ? (
              <div className="empty" aria-live="polite">
                Loading your library…
              </div>
            ) : error ? (
              <div className="empty">
                <h3>Could not load your library</h3>
                <p>{error}</p>
                <button className="secondary" onClick={refresh}>
                  Retry
                </button>
              </div>
            ) : result.groups.length ? (
              <div className="group-cards">
                {result.groups.map((group) => (
                  <button
                    className="group-card"
                    key={JSON.stringify(group.path)}
                    onClick={() => {
                      setGroupPath(group.path);
                      setPage(1);
                    }}
                  >
                    <Icon name="layers" size={22} />
                    <strong>{pathLabel(group.path)}</strong>
                    <span>
                      {group.count} {group.count === 1 ? 'occurrence' : 'occurrences'}
                    </span>
                    <b>Explore group →</b>
                  </button>
                ))}
              </div>
            ) : result.items.length ? (
              <div className="cards">
                {result.items.map((item) => (
                  <button
                    className="occ-card"
                    key={item.id}
                    onClick={() => open(item.id)}
                    disabled={busy}
                  >
                    <div className="card-chart">
                      {item.coverImage && (
                        <img src={imageUrl(item.coverImage.url)} alt={`${item.title} preview`} />
                      )}
                      <span className="image-badge">
                        <Icon name="image" size={13} /> {item.imageCount}
                      </span>
                    </div>
                    <div className="card-body">
                      <div className="card-meta">
                        <span>
                          {item.study.tags.find((tag) => norm(tag.key) === 'instrument')?.value ||
                            item.study.name}
                        </span>
                        <span>{item.date || 'Undated'}</span>
                      </div>
                      <h4>{item.title}</h4>
                      <p>{item.notes}</p>
                      <div className="card-tags">
                        {item.tags.slice(0, 3).map((tag, index) => (
                          <TagChip tag={tag} key={index} />
                        ))}
                      </div>
                      <div className="card-foot">
                        <strong>
                          Review sequence <Icon name="right" size={14} />
                        </strong>
                        <span>{item.study.name}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty">
                <Icon name="layers" size={30} />
                <h3>{studies.length ? 'No occurrences match' : 'Start your first study'}</h3>
                <p>
                  {studies.length
                    ? 'Adjust the filters or add an occurrence with one or more chart images.'
                    : 'Create a collection for a pattern or day type you want to understand.'}
                </p>
                <button
                  className="secondary"
                  onClick={() => (studies.length ? startOccurrence() : startStudy())}
                >
                  {studies.length ? 'Add occurrence' : 'Create study'}
                </button>
                <button
                  className="back"
                  onClick={() => {
                    setText('');
                    setDateFrom('');
                    setDateTo('');
                    setFilter(emptyFilter);
                    resetSelection();
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            {!loading && result.total > 0 && (
              <div className="pagination">
                <button
                  className="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {maxPage} · {result.total}{' '}
                  {result.groups.length ? 'groups' : 'occurrences'}
                </span>
                <button
                  className="secondary"
                  disabled={page >= maxPage}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      {modal && (
        <div
          className="modal-shade"
          onMouseDown={(event) => {
            if (!busy && event.target === event.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal === 'study' ? 'Study editor' : 'Occurrence editor'}
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">{draft.id ? 'EDIT' : 'ADD TO YOUR LIBRARY'}</span>
                <h2>
                  {modal === 'study'
                    ? `${draft.id ? 'Edit' : 'Create'} a study`
                    : modal === 'append'
                      ? 'Add images'
                      : `${draft.id ? 'Edit' : 'Add'} an occurrence`}
                </h2>
                <p>Tags are yours to define. Choose suggestions or create new values.</p>
              </div>
              <button
                className="icon-btn"
                disabled={busy}
                aria-label="Close editor"
                onClick={() => setModal(null)}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="modal-body">
              {modalError && (
                <div className="error-banner" role="alert">
                  {modalError}
                </div>
              )}
              {modal === 'study' ? (
                <>
                  <label>
                    Name
                    <input
                      autoFocus
                      value={draft.name}
                      onChange={(event) => changeDraft({ name: event.target.value })}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      value={draft.description}
                      onChange={(event) => changeDraft({ description: event.target.value })}
                    />
                  </label>
                  <label>Study tags</label>
                  <TagEditor tags={draft.tags} onChange={(tags) => changeDraft({ tags })} />
                </>
              ) : (
                <>
                  {modal !== 'append' && (
                    <>
                      <label>
                        Study
                        <select
                          value={draft.studyId}
                          onChange={(event) => changeDraft({ studyId: event.target.value })}
                        >
                          {studies.map((study) => (
                            <option value={study.id} key={study.id}>
                              {study.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="two-fields">
                        <label>
                          Title
                          <input
                            autoFocus
                            value={draft.title}
                            onChange={(event) => changeDraft({ title: event.target.value })}
                          />
                        </label>
                        <label>
                          Chart date
                          <input
                            type="date"
                            value={draft.date}
                            onChange={(event) => changeDraft({ date: event.target.value })}
                          />
                        </label>
                      </div>
                      <label>
                        Notes
                        <textarea
                          value={draft.notes}
                          onChange={(event) => changeDraft({ notes: event.target.value })}
                        />
                      </label>
                      <label>Occurrence tags</label>
                      <TagEditor tags={draft.tags} onChange={(tags) => changeDraft({ tags })} />
                    </>
                  )}
                  {!draft.id && (
                    <>
                      <label className="upload">
                        <Icon name="upload" size={24} />
                        <strong>Add chart images</strong>
                        <span>PNG, JPEG, WebP · up to 20 images · 15 MiB per file</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          multiple
                          onChange={(event) => {
                            const files = [...draft.files, ...Array.from(event.target.files ?? [])];
                            changeDraft({
                              files,
                              stages: files.map((_, index) => draft.stages[index] ?? ''),
                            });
                            event.target.value = '';
                          }}
                        />
                      </label>
                      <div className="file-list">
                        {draft.files.map((file, index) => (
                          <div key={index}>
                            <b>{index + 1}</b>
                            <span>{file.name}</span>
                            <input
                              aria-label={`Stage for image ${index + 1}`}
                              placeholder="Stage, e.g. entry"
                              value={draft.stages[index] ?? ''}
                              onChange={(event) =>
                                changeDraft({
                                  stages: draft.stages.map((value, i) =>
                                    i === index ? event.target.value : value
                                  ),
                                })
                              }
                            />
                            <button
                              className="icon-btn"
                              aria-label={`Remove file ${index + 1}`}
                              onClick={() =>
                                changeDraft({
                                  files: draft.files.filter((_, i) => i !== index),
                                  stages: draft.stages.filter((_, i) => i !== index),
                                })
                              }
                            >
                              <Icon name="close" size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
              {progress !== null && (
                <div className="upload-progress">
                  <progress value={progress} max={100} />
                  <span>
                    {progress === 100 ? 'Validating and saving images…' : `Uploading ${progress}%`}
                  </span>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <small>Saved to your chart library.</small>
              <div>
                <button className="secondary" disabled={busy} onClick={() => setModal(null)}>
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    (modal === 'study'
                      ? !draft.name.trim()
                      : modal === 'append'
                        ? !draft.files.length
                        : !draft.title.trim() ||
                          !draft.studyId ||
                          (!draft.id && !draft.files.length))
                  }
                  onClick={submit}
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
