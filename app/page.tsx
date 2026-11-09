"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  ExternalLink,
  FolderHeart,
  Github,
  Grid2X2,
  KeyRound,
  List,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type {
  GitHubProfile,
  GitHubUser,
  SavedUser,
  SearchResult,
} from "@/src/types";

const BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001"
).replace(/\/$/, "");
const TOKEN_KEY = "octoshelf-access-token";
const number = (value: number) => new Intl.NumberFormat("zh-CN").format(value);

class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export default function Home() {
  const [view, setView] = useState<"discover" | "saved">("discover");
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<SavedUser[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [detail, setDetail] = useState<GitHubProfile | SavedUser | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavedUser | null>(null);
  const [settings, setSettings] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [storage, setStorage] = useState("");
  const searchController = useRef<AbortController | null>(null);
  const detailController = useRef<AbortController | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = sessionStorage.getItem(TOKEN_KEY);
    let response: Response;
    try {
      response = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw e;
      throw new Error("无法连接 API，请检查后端是否已启动及网络连接");
    }
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (response.status === 401) setSettings(true);
      throw new RequestError(
        data.message ?? `请求失败（${response.status}）`,
        response.status,
      );
    }
    return response.status === 204
      ? (undefined as T)
      : (response.json() as Promise<T>);
  }

  async function loadSaved() {
    setSavedLoading(true);
    try {
      const data = await request<{ items: SavedUser[] }>("/users");
      setSaved(data.items);
      setConnected(true);
    } catch (e) {
      setError((e as Error).message);
      setConnected(false);
    } finally {
      setSavedLoading(false);
    }
  }

  useEffect(() => {
    setTokenInput(sessionStorage.getItem(TOKEN_KEY) ?? "");
    void loadSaved();
    void fetch(`${BASE}/health`)
      .then((r) => {
        if (!r.ok) throw new Error("health");
        return r.json();
      })
      .then((data: { storage: string; authRequired: boolean }) => {
        setStorage(data.storage === "postgres" ? "PostgreSQL" : "本地文件");
        if (data.authRequired && !sessionStorage.getItem(TOKEN_KEY))
          setSettings(true);
      })
      .catch(() => setConnected(false));
    return () => {
      searchController.current?.abort();
      detailController.current?.abort();
    };
    // Initialization runs once; user actions explicitly refresh data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  async function search(value: string, targetPage = 1) {
    const q = value.trim();
    if (!q) {
      searchInput.current?.focus();
      return;
    }
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setQuery(q);
    setView("discover");
    setLoading(true);
    setError("");
    try {
      const data = await request<SearchResult>(
        `/search/users?${new URLSearchParams({ q, page: String(targetPage) })}`,
        { signal: controller.signal },
      );
      setResult(data);
      setSearched(q);
      setPage(targetPage);
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  async function add(user: GitHubUser) {
    setBusy(user.id);
    setError("");
    try {
      const profile = await request<SavedUser>("/users", {
        method: "POST",
        body: JSON.stringify({ login: user.login }),
      });
      setSaved((items) => [
        profile,
        ...items.filter((u) => u.id !== profile.id),
      ]);
      setToast(`已将 ${user.login} 加入收藏`);
      if (detail?.id === user.id) {
        setDetail(profile);
        setNote(profile.note);
        setTags(profile.tags.join(", "));
      }
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof RequestError && e.status === 409) await loadSaved();
    } finally {
      setBusy(null);
    }
  }

  async function openDetail(user: GitHubUser) {
    setError("");
    const existing = saved.find((u) => u.id === user.id);
    if (existing) {
      setDetail(existing);
      setNote(existing.note);
      setTags(existing.tags.join(", "));
      return;
    }
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    setDetailLoading(true);
    try {
      setDetail(
        await request<GitHubProfile>(
          `/github/users/${encodeURIComponent(user.login)}`,
          { signal: controller.signal },
        ),
      );
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message);
    } finally {
      if (!controller.signal.aborted) setDetailLoading(false);
    }
  }

  async function saveNotes(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusy(detail.id);
    setError("");
    try {
      const updated = await request<SavedUser>(`/users/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          note,
          tags: tags
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      setSaved((items) =>
        items.map((u) => (u.id === updated.id ? updated : u)),
      );
      setDetail(null);
      setToast("备注与标签已更新");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(deleteTarget.id);
    setError("");
    try {
      await request<void>(`/users/${deleteTarget.id}`, { method: "DELETE" });
      setSaved((items) => items.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDetail(null);
      setToast("已移出收藏");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const visibleSaved = saved.filter((u) =>
    `${u.login} ${u.name ?? ""} ${u.note} ${u.tags.join(" ")}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const tagCount = new Set(saved.flatMap((u) => u.tags)).size;
  const totalPages = result
    ? Math.min(84, Math.ceil(Math.min(result.total_count, 1000) / 12))
    : 0;
  const shownUsers: GitHubUser[] =
    view === "saved" ? visibleSaved : (result?.items ?? []);

  function card(user: GitHubUser) {
    const favorite = saved.find((u) => u.id === user.id);
    return (
      <article
        className={`user-card ${layout === "list" ? "user-row" : ""}`}
        key={user.id}>
        <div className="card-top">
          <img
            className="avatar"
            src={user.avatar_url}
            alt={`${user.login} 的头像`}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <span
            className={`type-badge ${user.type === "Organization" ? "org" : ""}`}>
            {user.type === "Organization" ? "组织" : "开发者"}
          </span>
        </div>
        <div className="card-info">
          <button className="user-name" onClick={() => void openDetail(user)}>
            {favorite?.name || user.login}
            <ArrowUpRight size={17} />
          </button>
          <a
            className="login"
            href={user.html_url}
            target="_blank"
            rel="noreferrer">
            @{user.login}
          </a>
          {favorite && (
            <p className="card-bio">
              {favorite.bio || favorite.note || "还没有简介，添加一条备注吧。"}
            </p>
          )}
          {favorite?.tags.length ? (
            <div className="tags">
              {favorite.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="card-bottom">
          <span className="card-meta">
            <Github size={13} /> GitHub
          </span>
          {view === "saved" ? (
            <div className="card-actions">
              <button
                className="text-button"
                onClick={() => void openDetail(user)}>
                编辑备注
              </button>
              <button
                className="icon-button danger"
                aria-label={`移除 ${user.login}`}
                onClick={() => setDeleteTarget(favorite!)}>
                <Trash2 size={15} />
              </button>
            </div>
          ) : (
            <button
              className={`save-button ${favorite ? "is-saved" : ""}`}
              disabled={Boolean(favorite) || busy === user.id}
              onClick={() => void add(user)}>
              {busy === user.id ? (
                <LoaderCircle size={14} className="spin" />
              ) : favorite ? (
                <Check size={14} />
              ) : (
                <Plus size={14} />
              )}
              {favorite ? "已收藏" : "加入收藏"}
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="OctoShelf 首页">
          <span className="brand-mark">
            <Github size={23} />
          </span>
          <span>
            Octo<span className="brand-light">Shelf</span>
            <small>DEVELOPER COLLECTION</small>
          </span>
        </a>
        <div className="workspace-label">
          我的工作空间 <span>个人</span>
        </div>
        <nav aria-label="主导航">
          <button
            className={view === "discover" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setView("discover");
              setError("");
            }}>
            <Search size={19} />
            发现开发者 <span className="nav-dot" />
          </button>
          <button
            className={view === "saved" ? "nav-item active" : "nav-item"}
            onClick={() => {
              setView("saved");
              setError("");
              void loadSaved();
            }}>
            <FolderHeart size={19} />
            我的收藏 <span className="nav-count">{saved.length}</span>
          </button>
        </nav>
        <div className="sidebar-caption">让优秀的人，成为你的灵感。</div>
        <div className="sidebar-bottom">
          <div className="project-card">
            <span className="project-icon">
              <Code2 size={18} />
            </span>
            <strong>小项目，大连接。</strong>
            <p>
              从一个用户名开始，
              <br />
              发现开源世界的无限可能。
            </p>
            <span className="project-pill">
              AWS 全栈实践 <ArrowUpRight size={12} />
            </span>
          </div>
          <button className="sidebar-setting" onClick={() => setSettings(true)}>
            <Settings2 size={17} />
            连接设置 <ChevronRight size={15} />
          </button>
          <div className="sidebar-footer">
            <span className="mini-avatar">我</span>
            <div>
              <strong>我的开发者空间</strong>
              <small>Build something meaningful</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            工作空间 <ChevronRight size={14} />
            <span>{view === "discover" ? "发现开发者" : "我的收藏"}</span>
          </div>
          <div className="topbar-right">
            <span className="connection">
              <i className={connected ? "online" : ""} />
              {connected ? "API 已连接" : "API 未连接"}
            </span>
            <button
              className="icon-button settings-button"
              aria-label="连接设置"
              onClick={() => setSettings(true)}>
              <Settings2 size={17} />
            </button>
            <span className="top-avatar">我</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> YOUR NEXT CONNECTION
              </div>
              <h1>
                {view === "discover" ? (
                  <>
                    发现优秀的<span>开发者</span>
                    <span className="heading-period">.</span>
                  </>
                ) : (
                  <>
                    你的开源<span>收藏夹</span>
                    <span className="heading-period">.</span>
                  </>
                )}
              </h1>
              <p>
                {view === "discover"
                  ? "探索 GitHub 上有趣的灵魂，把值得关注的人留在这里。"
                  : "灵感不再擦肩而过。为你关注的开发者，留下自己的注解。"}
              </p>
            </div>
            <div className="heading-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <Github size={45} strokeWidth={1.3} />
              <span className="art-star">✳</span>
              <span className="art-dot" />
            </div>
          </div>

          <section className="stats" aria-label="收藏概览">
            <div className="stat">
              <span className="stat-icon green">
                <Bookmark size={19} />
              </span>
              <div>
                <span>已收藏开发者</span>
                <strong>
                  {savedLoading ? "—" : number(saved.length)}
                  <small>位</small>
                </strong>
              </div>
              <span className="stat-hint">持续积累，持续发现</span>
            </div>
            <div className="stat">
              <span className="stat-icon purple">
                <Users size={19} />
              </span>
              <div>
                <span>本次搜索结果</span>
                <strong>
                  {result ? number(result.total_count) : "—"}
                  <small>{result ? "位" : ""}</small>
                </strong>
              </div>
              <span className="stat-hint">连接开源世界</span>
            </div>
            <div className="stat">
              <span className="stat-icon amber">
                <Sparkles size={19} />
              </span>
              <div>
                <span>我的分类标签</span>
                <strong>
                  {number(tagCount)}
                  <small>个</small>
                </strong>
              </div>
              <span className="stat-hint">让收藏井井有条</span>
            </div>
          </section>

          {view === "discover" ? (
            <section className="search-panel">
              <div className="search-panel-title">
                <Search size={18} />
                <h2>下一位想认识谁？</h2>
                <h3>就输入Ta的大名</h3>
                <span>从一个名字开始</span>
              </div>
              <form
                className="search-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void search(query);
                }}>
                <Search size={21} />
                <input
                  ref={searchInput}
                  aria-label="GitHub 搜索关键词"
                  placeholder="输入 GitHub 用户名或关键词，例如 torvalds"
                  value={query}
                  maxLength={256}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  className="primary-button"
                  disabled={loading || !query.trim()}
                  type="submit">
                  {loading ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Search size={16} />
                  )}
                  搜索开发者
                </button>
              </form>
              <div className="suggestions">
                <span>试试搜索</span>
                {["torvalds", "gaearon", "vuejs", "location:Shanghai"].map(
                  (q) => (
                    <button
                      key={q}
                      disabled={loading}
                      onClick={() => void search(q)}>
                      {q}
                      <ArrowUpRight size={11} />
                    </button>
                  ),
                )}
              </div>
            </section>
          ) : (
            <section className="saved-search">
              <Search size={19} />
              <input
                aria-label="筛选收藏"
                placeholder="搜索收藏中的名字、备注或标签…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <span>{visibleSaved.length} 位开发者</span>
            </section>
          )}

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button aria-label="关闭错误提示" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          <section
            className="results-section"
            aria-busy={loading || (view === "saved" && savedLoading)}>
            <div className="section-header">
              <div>
                <h2>
                  {view === "saved"
                    ? "所有收藏"
                    : searched
                      ? "搜索结果"
                      : "开启你的发现之旅"}
                </h2>
                {view === "discover" && searched && (
                  <span className="result-label">
                    “{searched}”{" "}
                    <span>· {number(result?.total_count ?? 0)} 个结果</span>
                  </span>
                )}
                {view === "saved" && (
                  <span className="result-label">
                    {number(visibleSaved.length)} 位开发者
                  </span>
                )}
              </div>
              <div className="section-tools">
                <span className="sort-label">
                  <ArrowDown size={13} />
                  {view === "saved" ? "最近收藏" : "最佳匹配"}
                </span>
                <div className="layout-switch">
                  <button
                    aria-label="网格视图"
                    aria-pressed={layout === "grid"}
                    className={layout === "grid" ? "selected" : ""}
                    onClick={() => setLayout("grid")}>
                    <Grid2X2 size={16} />
                  </button>
                  <button
                    aria-label="列表视图"
                    aria-pressed={layout === "list"}
                    className={layout === "list" ? "selected" : ""}
                    onClick={() => setLayout("list")}>
                    <List size={17} />
                  </button>
                </div>
              </div>
            </div>
            {loading || (view === "saved" && savedLoading) ? (
              <div className="user-grid">
                {Array.from({ length: 6 }, (_, i) => (
                  <div className="skeleton-card" key={i}>
                    <div />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : shownUsers.length ? (
              <div className={layout === "grid" ? "user-grid" : "user-list"}>
                {shownUsers.map(card)}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-illustration">
                  <span />
                  <Github size={48} strokeWidth={1.2} />
                  <span />
                </div>
                <h3>
                  {view === "saved"
                    ? filter
                      ? "没有匹配的收藏"
                      : "值得关注的人，都可以留在这里"
                    : result
                      ? "暂时没有找到匹配的开发者"
                      : "每一次搜索，都是一次新的连接"}
                </h3>
                <p>
                  {view === "saved"
                    ? filter
                      ? "试试其他用户名、备注或标签。"
                      : "搜索感兴趣的开发者，点击「加入收藏」，建立你的第一份名单。"
                    : result
                      ? "换一个关键词，或尝试 GitHub 搜索语法。"
                      : "输入用户名、技术关键词或城市，发现你的下一位开源同行。"}
                </p>
                {view === "saved" ? (
                  <button
                    className="outline-button"
                    onClick={() => {
                      setView("discover");
                      setTimeout(() => searchInput.current?.focus(), 0);
                    }}>
                    去发现开发者 <ArrowRight size={15} />
                  </button>
                ) : (
                  <button
                    className="outline-button"
                    onClick={() => void search("torvalds")}>
                    认识一下 torvalds <ArrowUpRight size={15} />
                  </button>
                )}
                <div className="empty-note">
                  <span />
                  真实 GitHub 数据 · 收藏随时可管理
                </div>
              </div>
            )}
            {view === "discover" && result && totalPages > 1 && !loading && (
              <div className="pagination">
                <span>
                  GitHub 最多展示前 1,000 个结果
                  {result.incomplete_results ? " · 当前结果可能不完整" : ""}
                </span>
                <div>
                  <button
                    className="icon-button"
                    aria-label="上一页"
                    disabled={page <= 1}
                    onClick={() => void search(searched, page - 1)}>
                    <ChevronLeft size={17} />
                  </button>
                  <span>
                    {page} / {totalPages}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="下一页"
                    disabled={page >= totalPages}
                    onClick={() => void search(searched, page + 1)}>
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            )}
          </section>
          <footer className="content-footer">
            <span>
              <Github size={14} /> Built for curious minds.
            </span>
            <span>
              Next.js <i /> AWS Lambda <i /> {storage || "GitHub API"}
            </span>
          </footer>
        </div>
      </main>

      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {detailLoading && (
        <div className="toast" role="status">
          <LoaderCircle size={17} className="spin" />
          正在读取开发者资料…
        </div>
      )}
      {settings && (
        <Modal title="连接设置" onClose={() => setSettings(false)}>
          <p className="modal-description">
            本地开发默认无需令牌。连接 AWS 后，请输入你从自己的 Secrets Manager
            获取的项目访问令牌。
          </p>
          <div className="endpoint">
            <span>API 地址</span>
            <code>{BASE}</code>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tokenInput.trim())
                sessionStorage.setItem(TOKEN_KEY, tokenInput.trim());
              else sessionStorage.removeItem(TOKEN_KEY);
              setSettings(false);
              setError("");
              void loadSaved();
            }}>
            <label className="field-label" htmlFor="access-token">
              项目访问令牌
            </label>
            <input
              id="access-token"
              className="field"
              type="password"
              value={tokenInput}
              autoComplete="off"
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="本地无鉴权时留空"
            />
            <p className="field-hint">
              仅保存在当前浏览器标签页会话中，不会写入前端代码。
            </p>
            <button className="primary-button full-width" type="submit">
              <KeyRound size={16} />
              保存并连接
            </button>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title="开发者档案" onClose={() => setDetail(null)}>
          <div className="profile-heading">
            <img
              className="avatar large"
              src={detail.avatar_url}
              alt={`${detail.login} 的头像`}
            />
            <div>
              <h3>{detail.name || detail.login}</h3>
              <a href={detail.html_url} target="_blank" rel="noreferrer">
                @{detail.login}
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
          <p className="profile-bio">
            {detail.bio || "这位开发者还没有填写简介。"}
          </p>
          <div className="profile-facts">
            {detail.location && (
              <span>
                <MapPin size={14} />
                {detail.location}
              </span>
            )}
            <span>
              <Code2 size={14} />
              {number(detail.public_repos)} 仓库
            </span>
            <span>
              <Users size={14} />
              {number(detail.followers)} 关注者
            </span>
          </div>
          {saved.some((u) => u.id === detail.id) ? (
            <form onSubmit={(e) => void saveNotes(e)}>
              <label className="field-label" htmlFor="note">
                我的备注 <span>{note.length}/1000</span>
              </label>
              <textarea
                id="note"
                className="field"
                rows={4}
                maxLength={1000}
                value={note}
                placeholder="为什么关注这位开发者？记下你的想法…"
                onChange={(e) => setNote(e.target.value)}
              />
              <label className="field-label" htmlFor="tags">
                分类标签
              </label>
              <input
                id="tags"
                className="field"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例如：前端, 开源, 灵感"
              />
              <p className="field-hint">
                用逗号分隔，最多 8 个，每个最多 24 字。
              </p>
              <button
                className="primary-button full-width"
                disabled={busy === detail.id}
                type="submit">
                {busy === detail.id ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Check size={16} />
                )}
                保存备注
              </button>
            </form>
          ) : (
            <button
              className="primary-button full-width"
              disabled={busy === detail.id}
              onClick={() => void add(detail)}>
              <Plus size={16} />
              加入我的收藏
            </button>
          )}
          {error && (
            <p className="modal-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {deleteTarget && (
        <Modal title="移出收藏？" onClose={() => setDeleteTarget(null)}>
          <p className="modal-description">
            将移除 <strong>@{deleteTarget.login}</strong>{" "}
            及其备注和标签。之后可以重新收藏，原备注不会保留。
          </p>
          <div className="modal-actions">
            <button
              className="outline-button"
              onClick={() => setDeleteTarget(null)}>
              取消
            </button>
            <button
              className="delete-button"
              disabled={busy !== null}
              onClick={() => void remove()}>
              {busy !== null ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Trash2 size={15} />
              )}
              确认移除
            </button>
          </div>
          {error && (
            <p className="modal-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const box = ref.current.getBoundingClientRect();
          if (
            e.clientX < box.left ||
            e.clientX > box.right ||
            e.clientY < box.top ||
            e.clientY > box.bottom
          )
            onClose();
        }
      }}>
      <div className="modal-header">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="关闭对话框"
          onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
