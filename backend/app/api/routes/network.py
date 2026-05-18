"""Entity network endpoint."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Entity, EntityCooccurrence
from app.schemas.intelligence import NetworkEdge, NetworkGraph, NetworkNode

router = APIRouter(prefix="/network", tags=["network"])


@router.get("", response_model=NetworkGraph)
async def get_network(
    db: AsyncSession = Depends(get_db),
    min_weight: int = Query(5, ge=1),
    max_edges: int = Query(200, ge=10, le=1000),
) -> NetworkGraph:
    cutoff = date.today() - timedelta(days=14)
    edge_stmt = (
        select(
            EntityCooccurrence.entity_a_id,
            EntityCooccurrence.entity_b_id,
            EntityCooccurrence.count,
        )
        .where(EntityCooccurrence.window_start >= cutoff, EntityCooccurrence.count >= min_weight)
        .order_by(EntityCooccurrence.count.desc())
        .limit(max_edges)
    )
    edge_rows = (await db.execute(edge_stmt)).all()

    node_ids = sorted({eid for pair in edge_rows for eid in (pair[0], pair[1])})
    if not node_ids:
        return NetworkGraph(nodes=[], edges=[])

    weights = {eid: 0 for eid in node_ids}
    for ea, eb, c in edge_rows:
        weights[ea] += c
        weights[eb] += c

    ent_rows = (await db.execute(
        select(Entity.id, Entity.slug, Entity.name, Entity.type).where(Entity.id.in_(node_ids))
    )).all()
    nodes = [
        NetworkNode(id=eid, slug=slug, name=name, type=type_, weight=weights[eid])
        for (eid, slug, name, type_) in ent_rows
    ]
    edges = [NetworkEdge(source=ea, target=eb, weight=int(c)) for (ea, eb, c) in edge_rows]
    return NetworkGraph(nodes=nodes, edges=edges)
