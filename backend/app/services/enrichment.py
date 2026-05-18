"""Article enrichment: embedding + entities + topics + sentiment.

Designed for batch processing. The ML models are heavy to load (sentence-transformers
~700MB, spaCy ~50MB), so we process articles in batches inside one process.
"""

from collections import defaultdict
from dataclasses import dataclass

from loguru import logger
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Article, ArticleEntity, ArticleTopic, Entity, Topic
from app.services.text_utils import headline_plus_lead, slugify


@dataclass
class EnrichmentResult:
    article_id: int
    entity_count: int
    topic_count: int
    sentiment: float


async def fetch_unenriched_articles(
    session: AsyncSession,
    *,
    limit: int = 200,
) -> list[Article]:
    stmt = (
        select(Article)
        .where(Article.embedding.is_(None))
        .order_by(Article.id)
        .limit(limit)
    )
    res = await session.execute(stmt)
    return list(res.scalars().all())


async def _upsert_entities_by_natural_key(
    session: AsyncSession,
    items: list[tuple[str, str]],
) -> dict[tuple[str, str], int]:
    """For each (name, type) ensure an Entity row exists. Returns {(name,type): id}."""
    if not items:
        return {}
    rows = [
        {"name": name, "slug": slugify(f"{name}-{type_}"), "type": type_, "canonical_name": name}
        for (name, type_) in items
    ]
    stmt = pg_insert(Entity).values(rows).on_conflict_do_nothing(index_elements=["slug"])
    await session.execute(stmt)

    # Read back. Use slug as the lookup since (name, type) isn't unique-constrained.
    slugs = [r["slug"] for r in rows]
    res = await session.execute(
        select(Entity.id, Entity.name, Entity.type, Entity.slug).where(Entity.slug.in_(slugs))
    )
    by_slug: dict[str, int] = {row.slug: row.id for row in res.all()}
    return {(name, type_): by_slug[slugify(f"{name}-{type_}")] for (name, type_) in items}


async def _upsert_topics_by_name(
    session: AsyncSession,
    names: list[str],
) -> dict[str, int]:
    if not names:
        return {}
    rows = [{"name": n, "slug": slugify(n)} for n in names]
    stmt = pg_insert(Topic).values(rows).on_conflict_do_nothing(index_elements=["slug"])
    await session.execute(stmt)
    slugs = [r["slug"] for r in rows]
    res = await session.execute(
        select(Topic.id, Topic.slug).where(Topic.slug.in_(slugs))
    )
    by_slug = {row.slug: row.id for row in res.all()}
    return {n: by_slug[slugify(n)] for n in names}


async def enrich_articles(session: AsyncSession, articles: list[Article]) -> list[EnrichmentResult]:
    """Compute embeddings + entities + topics + sentiment for a batch.

    All sync ML work is wrapped in asyncio.to_thread so it runs on a thread
    pool — otherwise the FastAPI event loop is blocked while sentence-transformers
    + spaCy + KeyBERT do CPU-heavy work, and the API stops responding to requests.
    """
    import asyncio

    # Heavy imports kept inside the function so importing this module is cheap.
    from app.ml.embeddings import embed_batch
    from app.ml.ner import extract_entities
    from app.ml.sentiment import score_sentiment
    from app.ml.topics import extract_topics

    if not articles:
        return []

    texts = [headline_plus_lead(a.title, a.lead) for a in articles]

    def _heavy_work(texts: list[str]) -> tuple[list, list, list, list]:
        """All the sync ML work in one function so we to_thread it just once."""
        embeddings = embed_batch(texts)
        per_article_entities: list[list[tuple[str, str, int]]] = []
        per_article_topics: list[list[tuple[str, float]]] = []
        sentiments: list[float] = []
        for text in texts:
            ents = extract_entities(text)
            per_article_entities.append([(e.name, e.type, e.count) for e in ents])
            topics = extract_topics(text)
            per_article_topics.append([(t.name, t.score) for t in topics])
            sentiments.append(score_sentiment(text))
        return embeddings, per_article_entities, per_article_topics, sentiments

    # Offload to a worker thread so the event loop stays free for HTTP requests.
    embeddings, per_article_entities, per_article_topics, sentiments = (
        await asyncio.to_thread(_heavy_work, texts)
    )

    # 3) Upsert global entity/topic catalogs, get back id maps
    all_entity_keys = list({
        (name, type_)
        for ent_list in per_article_entities
        for (name, type_, _) in ent_list
    })
    entity_id_by_key = await _upsert_entities_by_natural_key(session, all_entity_keys)

    all_topic_names = list({n for tlist in per_article_topics for (n, _) in tlist})
    topic_id_by_name = await _upsert_topics_by_name(session, all_topic_names)

    # 4) For each article: update fields + write join rows
    ae_rows: list[dict] = []
    at_rows: list[dict] = []
    results: list[EnrichmentResult] = []
    for article, emb, ents, topics, sent in zip(
        articles, embeddings, per_article_entities, per_article_topics, sentiments, strict=True
    ):
        article.embedding = emb
        article.sentiment_score = sent
        session.add(article)

        # Aggregate per (article, entity) so we don't violate PK
        ent_counts: dict[int, int] = defaultdict(int)
        for (name, type_, count) in ents:
            key = (name, type_)
            eid = entity_id_by_key.get(key)
            if eid is None:
                continue
            ent_counts[eid] += count
        for eid, count in ent_counts.items():
            ae_rows.append({"article_id": article.id, "entity_id": eid, "mention_count": count})

        topic_scores: dict[int, float] = {}
        for (name, score) in topics:
            tid = topic_id_by_name.get(name)
            if tid is None:
                continue
            topic_scores[tid] = max(score, topic_scores.get(tid, 0.0))
        for tid, score in topic_scores.items():
            at_rows.append({"article_id": article.id, "topic_id": tid, "score": score})

        results.append(EnrichmentResult(
            article_id=article.id,
            entity_count=len(ent_counts),
            topic_count=len(topic_scores),
            sentiment=sent,
        ))

    if ae_rows:
        stmt = pg_insert(ArticleEntity).values(ae_rows).on_conflict_do_nothing(
            index_elements=["article_id", "entity_id"]
        )
        await session.execute(stmt)
    if at_rows:
        stmt = pg_insert(ArticleTopic).values(at_rows).on_conflict_do_nothing(
            index_elements=["article_id", "topic_id"]
        )
        await session.execute(stmt)

    await session.commit()
    logger.info(
        f"enriched {len(results)} articles "
        f"({sum(r.entity_count for r in results)} entity-mentions, "
        f"{sum(r.topic_count for r in results)} topic-mentions)"
    )
    return results
