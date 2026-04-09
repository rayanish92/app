from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone
from bson import ObjectId
from models.schemas import ConsumerCreate
from utils.auth import get_current_user

router = APIRouter(prefix='/consumers', tags=['consumers'])

def get_db(request: Request):
    return request.app.state.db

@router.get('')
async def get_consumers(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    db = get_db(request)
    await get_current_user(request, db)

    total = await db.consumers.count_documents({})
    consumers = await db.consumers.find({}, {'_id': 0}).skip(skip).limit(limit).to_list(limit)

    return {
        'items': consumers,
        'total': total,
        'skip': skip,
        'limit': limit,
        'has_more': (skip + limit) < total
    }

@router.post('')
async def create_consumer(consumer: ConsumerCreate, request: Request):
    db = get_db(request)
    await get_current_user(request, db)

    consumer_dict = consumer.model_dump()
    consumer_dict['id'] = str(ObjectId())
    consumer_dict['total_due'] = 0.0
    consumer_dict['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.consumers.insert_one(consumer_dict)
    consumer_dict.pop('_id', None)
    return consumer_dict

@router.put('/{consumer_id}')
async def update_consumer(consumer_id: str, consumer: ConsumerCreate, request: Request):
    db = get_db(request)
    await get_current_user(request, db)

    result = await db.consumers.update_one(
        {'id': consumer_id},
        {'$set': consumer.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Consumer not found')
    return {'message': 'Consumer updated successfully'}

@router.delete('/{consumer_id}')
async def delete_consumer(consumer_id: str, request: Request):
    db = get_db(request)
    await get_current_user(request, db)

    result = await db.consumers.delete_one({'id': consumer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Consumer not found')
    return {'message': 'Consumer deleted successfully'}
