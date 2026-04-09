from fastapi import APIRouter, HTTPException, Depends, Request, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from datetime import datetime, timezone
from bson import ObjectId
from ..models.schemas import Bill, BillCreate, RateConfig, RateConfigUpdate
from ..utils.auth import get_current_user

router = APIRouter(prefix='/bills', tags=['bills'])

def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db

@router.get('', response_model=dict)
async def get_bills(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    request: Request = None,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    await get_current_user(request, db)
    
    total = await db.bills.count_documents({})
    bills = await db.bills.find({}, {'_id': 0}).skip(skip).limit(limit).to_list(limit)
    
    return {
        'items': bills,
        'total': total,
        'skip': skip,
        'limit': limit,
        'has_more': (skip + limit) < total
    }

@router.post('')
async def create_bill(
    bill: BillCreate,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    await get_current_user(request, db)
    
    consumer = await db.consumers.find_one({'id': bill.consumer_id}, {'_id': 0})
    if not consumer:
        raise HTTPException(status_code=404, detail='Consumer not found')
    
    config = await db.rate_config.find_one({}, {'_id': 0})
    if not config:
        config = {'rate_per_bigha': 100.0, 'katha_to_bigha_ratio': 20.0}
    
    total_land_in_bigha = bill.land_used_bigha + (bill.land_used_katha / config['katha_to_bigha_ratio'])
    amount = total_land_in_bigha * config['rate_per_bigha']
    
    bill_dict = {
        'id': str(ObjectId()),
        'consumer_id': bill.consumer_id,
        'consumer_name': consumer['name'],
        'land_used_bigha': bill.land_used_bigha,
        'land_used_katha': bill.land_used_katha,
        'total_land_in_bigha': round(total_land_in_bigha, 2),
        'amount': round(amount, 2),
        'paid': 0.0,
        'due': round(amount, 2),
        'billing_period': bill.billing_period,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.bills.insert_one(bill_dict)
    
    # Update consumer total due
    total_due = await db.bills.aggregate([
        {'$match': {'consumer_id': bill.consumer_id}},
        {'$group': {'_id': None, 'total': {'$sum': '$due'}}}
    ]).to_list(1)
    new_total_due = total_due[0]['total'] if total_due else 0.0
    await db.consumers.update_one(
        {'id': bill.consumer_id},
        {'$set': {'total_due': round(new_total_due, 2)}}
    )
    
    return bill_dict

@router.delete('/{bill_id}')
async def delete_bill(
    bill_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    await get_current_user(request, db)
    
    bill = await db.bills.find_one({'id': bill_id}, {'_id': 0})
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    
    consumer_id = bill['consumer_id']
    await db.bills.delete_one({'id': bill_id})
    
    # Update consumer total due
    total_due = await db.bills.aggregate([
        {'$match': {'consumer_id': consumer_id}},
        {'$group': {'_id': None, 'total': {'$sum': '$due'}}}
    ]).to_list(1)
    new_total_due = total_due[0]['total'] if total_due else 0.0
    await db.consumers.update_one(
        {'id': consumer_id},
        {'$set': {'total_due': round(new_total_due, 2)}}
    )
    
    return {'message': 'Bill deleted successfully'}

@router.get('/rate-config', response_model=RateConfig)
async def get_rate_config(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    await get_current_user(request, db)
    
    config = await db.rate_config.find_one({}, {'_id': 0})
    if not config:
        config = {'rate_per_bigha': 100.0, 'katha_to_bigha_ratio': 20.0}
        await db.rate_config.insert_one(config)
    return config

@router.put('/rate-config')
async def update_rate_config(
    config: RateConfigUpdate,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    await get_current_user(request, db)
    
    await db.rate_config.delete_many({})
    await db.rate_config.insert_one(config.model_dump())
    return config
