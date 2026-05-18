from pydantic import BaseModel


class TopicListItem(BaseModel):
    slug: str
    name: str
    article_count_7d: int = 0


class TopicDetail(TopicListItem):
    recent_stories: list[dict]
    related_topics: list[str]
