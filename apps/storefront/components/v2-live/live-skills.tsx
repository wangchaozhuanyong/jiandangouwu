"use client";

import type {
  Locale,
  SkillCategorySummary,
  SkillDetail,
  SkillSummary,
} from "@cloudbridge/contracts";
import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  Code,
  GithubLogo,
  MagnifyingGlass,
  Package,
  Plug,
  PuzzlePiece,
  ShieldCheck,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSkills } from "../../lib/api";
import { ResilientImage } from "../resilient-image";
import { V2ContentFrame, V2HeroFrame, V2PageFrame } from "./page-frame";

const labels = {
  zh: {
    title: "先看用途，再决定是否安装。",
    body: "通过用途、兼容环境与来源信息，判断它是否适合当前任务。",
    search: "搜索 Skill、Plugin、Connector 或兼容环境",
    all: "全部 Skill",
    categories: "Skill 分类",
    empty: "没有找到匹配内容",
    emptyBody: "请缩短关键词或切换其他分类。",
    pending: "Skill 内容正在整理",
    pendingBody: "这里会在内容发布后展示分类与工具条目。",
    clear: "清除筛选",
    error: "Skill 内容暂时无法连接",
    retry: "重新连接",
    official: "官方来源",
    community: "社区来源",
    compatible: "兼容",
    verified: "核验",
    safety: "安装前检查",
    safetyBody:
      "来源级别只描述发布来源，不等于安全认证。安装前请复核仓库、权限、许可证和最近更新。",
    back: "返回 Skill 推荐",
    purpose: "用途说明",
    suitable: "适用任务",
    unsuitable: "不适用任务",
    install: "安装提示",
    source: "来源",
    maintainer: "维护者",
    license: "许可证",
    docs: "文档",
    github: "GitHub 仓库",
  },
  en: {
    title: "Understand the tool before you install it.",
    body: "Use purpose, compatibility, and source information to decide whether it fits the task.",
    search: "Search Skills, Plugins, Connectors, or environments",
    all: "All skills",
    categories: "Skill categories",
    empty: "No matching content",
    emptyBody: "Try a shorter query or another category.",
    pending: "Skill content is being prepared",
    pendingBody: "Published categories and tools will appear here.",
    clear: "Clear filters",
    error: "Skill content is temporarily unavailable",
    retry: "Reconnect",
    official: "Official source",
    community: "Community source",
    compatible: "Works with",
    verified: "Verified",
    safety: "Before installation",
    safetyBody:
      "Source level describes provenance; it is not a security certification. Review the repository, permissions, license, and recent updates before installing.",
    back: "Back to Skill picks",
    purpose: "Purpose",
    suitable: "Suitable tasks",
    unsuitable: "Unsuitable tasks",
    install: "Installation note",
    source: "Source",
    maintainer: "Maintainer",
    license: "License",
    docs: "Documentation",
    github: "GitHub repository",
  },
} as const;

function safeGitHub(url: string) {
  try {
    const value = new URL(url);
    return value.protocol === "https:" && value.hostname === "github.com";
  } catch {
    return false;
  }
}

function updateQuery(values: Record<string, string>) {
  const next = new URLSearchParams(window.location.search);
  Object.entries(values).forEach(([key, value]) =>
    value ? next.set(key, value) : next.delete(key),
  );
  const query = next.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`,
  );
}

function SkillCard({ locale, skill }: { locale: Locale; skill: SkillSummary }) {
  const t = labels[locale];
  const Icon =
    skill.resourceType === "CONNECTOR"
      ? Plug
      : skill.resourceType === "PLUGIN"
        ? PuzzlePiece
        : Code;
  return (
    <article className="v2-preview-skill-card">
      <Link
        aria-label={skill.name}
        className="v2-preview-skill-card__hit"
        href={`/${locale}/skills/${skill.slug}`}
      />
      <div className="v2-preview-skill-card__visual">
        <span>
          <Icon aria-hidden="true" size={23} />
        </span>
        <small>{skill.resourceType}</small>
      </div>
      <div className="v2-preview-skill-card__body">
        <span className="v2-preview-skill-card__source">
          {skill.sourceLevel === "OFFICIAL" ? t.official : t.community}
        </span>
        <h2>{skill.name}</h2>
        <p>{skill.summary}</p>
        <dl>
          <div>
            <dt>{t.compatible}</dt>
            <dd>{skill.compatibleEnvironments.join(" · ")}</dd>
          </div>
          <div>
            <dt>{t.verified}</dt>
            <dd>{skill.verifiedAt}</dd>
          </div>
        </dl>
      </div>
      <div className="v2-preview-skill-card__actions">
        {safeGitHub(skill.githubUrl) && (
          <a
            aria-label={`${skill.name} GitHub`}
            className="v2-action v2-action--secondary"
            href={skill.githubUrl}
            onClick={(event) => event.stopPropagation()}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GithubLogo aria-hidden="true" size={18} />
            <span>GitHub</span>
          </a>
        )}
      </div>
    </article>
  );
}

export function V2LiveSkills({
  categories,
  initialSkills,
  locale,
}: {
  categories: SkillCategorySummary[];
  initialSkills: SkillSummary[];
  locale: Locale;
}) {
  const t = labels[locale];
  const searchParams = useSearchParams();
  const requested = searchParams.get("filter")?.slice(0, 80) ?? "all";
  const [category, setCategory] = useState(
    categories.some((item) => item.slug === requested) ? requested : "all",
  );
  const [query, setQuery] = useState(
    searchParams.get("q")?.slice(0, 120) ?? "",
  );
  const [skills, setSkills] = useState(initialSkills);
  const [state, setState] = useState<"ready" | "loading" | "error">("ready");
  const initial = useRef(true);
  const visibleCategories = useMemo(
    () =>
      categories.filter((item) =>
        initialSkills.some((skill) => skill.categoryId === item.id),
      ),
    [categories, initialSkills],
  );
  const isPublishedCatalogEmpty =
    initialSkills.length === 0 && !query.trim() && category === "all";

  useEffect(() => {
    if (
      category === "all" ||
      visibleCategories.some((item) => item.slug === category)
    )
      return;
    setCategory("all");
    updateQuery({ filter: "" });
  }, [category, visibleCategories]);
  useEffect(() => {
    if (initial.current && category === "all" && !query.trim()) {
      initial.current = false;
      return undefined;
    }
    initial.current = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState("loading");
      void getSkills({
        locale,
        category: category === "all" ? undefined : category,
        search: query.trim() || undefined,
        signal: controller.signal,
      })
        .then((result) => {
          setSkills(result.data);
          setState("ready");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError")
            return;
          setState("error");
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, locale, query]);

  const clear = () => {
    setCategory("all");
    setQuery("");
    updateQuery({ filter: "", q: "" });
  };
  return (
    <main className="v2-page-surface v2-preview-page v2-preview-skills-page">
      <V2HeroFrame>
        <section
          className={`v2-preview-skills-intro${isPublishedCatalogEmpty ? " is-empty" : ""}`}
        >
          <div className="v2-live-skills-intro__copy">
            <h1>{t.title}</h1>
            <p>{t.body}</p>
          </div>
          <div className="v2-live-skills-intro__media">
            <ResilientImage
              alt=""
              fallbackLabel={
                locale === "zh" ? "图片暂时无法显示" : "Image unavailable"
              }
              height={720}
              sizes="(max-width: 760px) 42vw, 46vw"
              src="/assets/hero-codex.webp"
              width={1600}
            />
          </div>
        </section>
      </V2HeroFrame>
      <V2ContentFrame layout="commerce">
        <section className="v2-preview-skills-catalog">
        <div className="v2-preview-skill-discovery">
          <label>
            <MagnifyingGlass aria-hidden="true" size={19} />
            <input
              aria-label={t.search}
              onChange={(event) => {
                const value = event.target.value.slice(0, 120);
                setQuery(value);
                updateQuery({ q: value.trim() });
              }}
              placeholder={t.search}
              type="search"
              value={query}
            />
            {query && (
              <button
                aria-label={t.clear}
                className="v2-action v2-action--icon"
                onClick={() => {
                  setQuery("");
                  updateQuery({ q: "" });
                }}
                type="button"
              >
                <X aria-hidden="true" size={17} />
              </button>
            )}
          </label>
        </div>
        <div className="v2-preview-skills-catalog__main">
          <nav
            aria-label={t.categories}
            className="v2-preview-skill-categories"
          >
            <button
              aria-pressed={category === "all"}
              className={category === "all" ? "is-active" : ""}
              onClick={() => {
                setCategory("all");
                updateQuery({ filter: "" });
              }}
              type="button"
            >
              {t.all}
            </button>
            {visibleCategories.map((item) => (
              <button
                aria-pressed={category === item.slug}
                className={category === item.slug ? "is-active" : ""}
                key={item.id}
                onClick={() => {
                  setCategory(item.slug);
                  updateQuery({ filter: item.slug });
                }}
                type="button"
              >
                {item.name}
              </button>
            ))}
          </nav>
          <div
            className="v2-preview-skill-results"
            aria-busy={state === "loading"}
          >
            {state === "error" ? (
              <div className="v2-preview-state is-error">
                <span>
                  <WarningCircle aria-hidden="true" size={25} />
                </span>
                <h3>{t.error}</h3>
                <button className="v2-action v2-action--secondary" onClick={clear} type="button">
                  {t.retry}
                </button>
              </div>
            ) : skills.length ? (
              <div
                className={`v2-preview-skill-grid${state === "loading" ? " is-refreshing" : ""}`}
              >
                {skills.map((skill) => (
                  <SkillCard key={skill.id} locale={locale} skill={skill} />
                ))}
              </div>
            ) : (
              <div
                className={`v2-preview-state is-empty${isPublishedCatalogEmpty ? " v2-live-skills__pending" : ""}`}
              >
                <span>
                  <Package aria-hidden="true" size={25} />
                </span>
                <h3>{isPublishedCatalogEmpty ? t.pending : t.empty}</h3>
                <p>{isPublishedCatalogEmpty ? t.pendingBody : t.emptyBody}</p>
                {!isPublishedCatalogEmpty && (
                  <button className="v2-action v2-action--tertiary" onClick={clear} type="button">
                    {t.clear}
                  </button>
                )}
              </div>
            )}
            <aside className="v2-preview-skill-safety">
              <ShieldCheck aria-hidden="true" size={25} />
              <div>
                <h2>{t.safety}</h2>
                <p>{t.safetyBody}</p>
              </div>
            </aside>
          </div>
        </div>
        </section>
      </V2ContentFrame>
    </main>
  );
}

export function V2LiveSkillDetail({
  locale,
  skill,
}: {
  locale: Locale;
  skill: SkillDetail;
}) {
  const t = labels[locale];
  return (
    <V2PageFrame className="v2-preview-skill-detail" layout="reading">
      <nav>
        <Link className="v2-action v2-action--tertiary" href={`/${locale}/skills`}>
          <ArrowLeft aria-hidden="true" size={16} />
          {t.back}
        </Link>
      </nav>
      <header>
        <div>
          <span>
            <Code aria-hidden="true" size={26} />
          </span>
          <small>
            {skill.resourceType} ·{" "}
            {skill.sourceLevel === "OFFICIAL" ? t.official : t.community}
          </small>
          <h1>{skill.name}</h1>
          <p>{skill.summary}</p>
        </div>
        <dl>
          <div>
            <dt>{t.source}</dt>
            <dd>{skill.sourceLevel}</dd>
          </div>
          <div>
            <dt>{t.maintainer}</dt>
            <dd>{skill.maintainer}</dd>
          </div>
          <div>
            <dt>{t.verified}</dt>
            <dd>{skill.verifiedAt}</dd>
          </div>
          <div>
            <dt>{t.license}</dt>
            <dd>{skill.license}</dd>
          </div>
        </dl>
      </header>
      <div className="v2-preview-skill-detail__content">
        <section>
          <article>
            <span>01</span>
            <div>
              <h2>{t.purpose}</h2>
              <p>{skill.description}</p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h2>{t.suitable}</h2>
              {skill.suitableFor.map((item) => (
                <p key={item}>
                  <CheckCircle aria-hidden="true" size={16} />
                  {item}
                </p>
              ))}
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h2>{t.unsuitable}</h2>
              {skill.unsuitableFor.map((item) => (
                <p key={item}>
                  <X aria-hidden="true" size={16} />
                  {item}
                </p>
              ))}
            </div>
          </article>
          <article>
            <span>04</span>
            <div>
              <h2>{t.install}</h2>
              <p>{skill.installHint}</p>
            </div>
          </article>
        </section>
        <aside>
          <small>{t.source}</small>
          <h2>{skill.name}</h2>
          {safeGitHub(skill.githubUrl) && (
            <a className="v2-action v2-action--secondary" href={skill.githubUrl} rel="noopener noreferrer" target="_blank">
              <GithubLogo aria-hidden="true" size={18} />
              <span>{t.github}</span>
              <ArrowSquareOut aria-hidden="true" size={16} />
            </a>
          )}
          {skill.documentationUrl && (
            <a
              className="v2-action v2-action--secondary"
              href={skill.documentationUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <Code aria-hidden="true" size={18} />
              <span>{t.docs}</span>
              <ArrowSquareOut aria-hidden="true" size={16} />
            </a>
          )}
          <p>{t.safetyBody}</p>
        </aside>
      </div>
    </V2PageFrame>
  );
}
