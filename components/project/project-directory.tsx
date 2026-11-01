"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Compass,
  Layers3,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Panel, StatusPill, Button } from "@/components/ui";
import { PROJECT_CATEGORIES, type DirectoryEntry } from "@/lib/directory";

export function ProjectDirectory() {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [examples, setExamples] = useState(false);
  const [rows, setRows] = useState<DirectoryEntry[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [request, setRequest] = useState({
    query: "",
    category: "All",
    examples: false,
    after: "",
  });
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    if (!request.after) {
      setRows([]);
      setCursor(null);
    }
    const params = new URLSearchParams({
      q: request.query,
      category: request.category,
      examples: String(request.examples),
      after: request.after,
    });
    void fetch(`/api/directory?${params}`, {
      signal: abort.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (!abort.signal.aborted) {
          setRows((old) =>
            request.after ? [...old, ...data.projects] : data.projects,
          );
          setCursor(data.nextCursor);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [request]);
  return (
    <div className="space-y-7">
      <section className="product-heading">
        <div>
          <p className="product-eyebrow">The Portaldot ecosystem</p>
          <h1>Discover what teams are building.</h1>
          <p>
            Explore community-published projects and the assets behind them.
          </p>
        </div>
        <Link className="product-primary" href="/import">
          <Plus size={16} /> Add your project
        </Link>
      </section>
      <div className="context-strip">
        <span>
          <span className="live-dot" /> V3 Testnet
        </span>
        <span>Published by the community</span>
        <Link href="/network">
          Browse all network assets <ArrowUpRight size={14} />
        </Link>
      </div>
      <form
        className="directory-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setRequest({ query, category, examples, after: "" });
        }}
      >
        <label className="directory-search">
          <Search size={17} />
          <span className="sr-only">Search projects</span>
          <input
            maxLength={100}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a project or use case"
          />
        </label>
        <label>
          <span className="sr-only">Project category</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setRequest({
                query,
                category: e.target.value,
                examples,
                after: "",
              });
            }}
          >
            {["All", ...PROJECT_CATEGORIES].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <Button disabled={loading} type="submit">
          Search
        </Button>
        <label className="example-toggle">
          <input
            type="checkbox"
            checked={examples}
            onChange={(e) => {
              setExamples(e.target.checked);
              setRequest({
                query,
                category,
                examples: e.target.checked,
                after: "",
              });
            }}
          />{" "}
          Include examples
        </label>
      </form>
      {error ? (
        <Panel className="p-6">
          <p role="alert" className="text-warn">
            {error}
          </p>
          <Button onClick={() => setRequest({ ...request })}>
            Retry directory
          </Button>
          <Link className="ml-4 text-violet" href="/network">
            Open network explorer ↗
          </Link>
        </Panel>
      ) : null}
      {loading && !rows.length ? (
        <div role="status" className="directory-grid">
          {[1, 2, 3].map((x) => (
            <div className="directory-skeleton" key={x}>
              <span />
              <span />
              <span />
            </div>
          ))}
          <span className="sr-only">Loading published projects</span>
        </div>
      ) : !error && !rows.length ? (
        <Panel className="directory-empty">
          <div className="empty-symbol">
            <Compass size={28} />
          </div>
          <h2>
            {request.query || request.category !== "All"
              ? "No projects match these filters."
              : "A place for the next wave of builders."}
          </h2>
          <p>
            {request.query || request.category !== "All"
              ? "Try another category or a shorter search."
              : "Projects appear here when their publishers choose to share them. Add an existing project, or start a guided launch."}
          </p>
          <div>
            <Link className="product-primary" href="/import">
              Bring your project <ArrowUpRight size={16} />
            </Link>
            <Link className="product-secondary" href="/launch">
              Start a launch
            </Link>
          </div>
          <Link href="/network" className="text-sm text-muted underline">
            Explore live network assets
          </Link>
        </Panel>
      ) : null}
      <div className="directory-grid">
        {rows.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      {cursor && (
        <Button
          disabled={loading}
          onClick={() => setRequest({ ...request, after: cursor })}
        >
          {loading ? "Loading…" : "Load more projects"}
        </Button>
      )}
      <details className="trust-note">
        <summary>
          <ShieldCheck size={16} /> What project labels mean
        </summary>
        <p>
          Publisher confirmed means a wallet signed the publication request.
          Chain role evidence names a specific role at a dated block. Reviewed
          means Portova reviewed this profile revision; it is not a security
          audit or financial endorsement. Descriptions and websites are
          publisher-provided. Examples are labelled and excluded by default.
        </p>
        <Link href="/workspace#pilot-request">
          Report a misleading project ↗
        </Link>
      </details>
    </div>
  );
}
function ProjectCard({ project }: { project: DirectoryEntry }) {
  const role =
    project.evidence?.assetOwner === true ||
    project.evidence?.collectionOwner === true;
  return (
    <article className="project-card">
      <div className="project-card-top">
        <div className="project-monogram" aria-hidden>
          {project.name.slice(0, 2).toUpperCase()}
        </div>
        <StatusPill tone="muted">{project.category}</StatusPill>
      </div>
      <div className="flex flex-wrap gap-2">
        {project.example && (
          <StatusPill tone="warn">Example project</StatusPill>
        )}
        <StatusPill tone="muted">
          {project.review === "reviewed"
            ? "Profile reviewed"
            : project.review === "pending"
              ? "Review pending"
              : "Community published"}
        </StatusPill>
      </div>
      <h2>
        <Link href={`/projects/${project.id}`}>{project.name}</Link>
      </h2>
      <p className="project-card-description">{project.description}</p>
      <div className="project-card-facts">
        <span>
          <Layers3 size={14} />
          {[
            project.assetId && "Token",
            project.collectionId && "NFT collection",
            project.poolLpToken && "Liquidity",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <span>
          {role
            ? "Publisher role matched at checked block"
            : "Publisher wallet confirmed"}
        </span>
        <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
      </div>
      <Link className="project-card-link" href={`/projects/${project.id}`}>
        View project <ArrowUpRight size={17} />
      </Link>
    </article>
  );
}
