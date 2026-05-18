from datetime import datetime

from pydantic import BaseModel


class EntityListItem(BaseModel):
    slug: str
    name: str
    type: str
    mention_count_7d: int = 0


class RelatedEntity(BaseModel):
    slug: str
    name: str
    type: str
    cooccurrence: int


class EntityDetail(EntityListItem):
    canonical_name: str | None
    wiki_url: str | None
    recent_stories: list[dict]  # {id, slug, name, source_count, last_updated_at}
    related: list[RelatedEntity]
