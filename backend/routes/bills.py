from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone
from bson import ObjectId
from models.schemas import BillCreate
from utils.auth import get_current_user

router = APIRouter(prefix='/bills', tags=['bills'])

def get_db(request: Request):
    return request.app.state.db

@router.get('')
async def get_bills(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    db = get_db(request)
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
@router.post("/bills")
async def create_bill(bill_data: BillCreate, request: Request):
    db = request.app.state.db
    
    # 1. FETCH THE SPECIFIC RATE FOR THE CHOSEN CATEGORY
    rate_config = await db.rate_config.find_one({"category": bill_data.category})
    
    if not rate_config:
        # Fallback if no rate is set for this category
        rate_per_bigha = 100.0
        katha_ratio = 20.0
    else:
        rate_per_bigha = rate_config['rate_per_bigha']
        katha_ratio = rate_config['katha_to_bigha_ratio']

    # 2. CALCULATE BASED ON CATEGORY RATES
    # Total Bigha = Bigha + (Katha / Ratio)
    total_land = bill_data.land_used_bigha + (bill_data.land_used_katha / katha_ratio)
    total_amount = round(total_land * rate_per_bigha, 2)

    new_bill = {
        "consumer_id": bill_data.consumer_id,
        "category": bill_data.category, # Storing the category is vital
        "amount": total_amount,
        "paid": 0,
        "due": total_amount,
        "land_used_bigha": bill_data.land_used_bigha,
        "land_used_katha": bill_data.land_used_katha,
        "total_land_in_bigha": round(total_land, 2),
        "billing_period": bill_data.billing_period,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.bills.insert_one(new_bill)
    return {"id": str(result.inserted_id)}

@router.post("/bills")
async def create_bill(bill_data: BillCreate, request: Request):
    db = request.app.state.db
    
    # 1. FETCH THE SPECIFIC RATE FOR THE CHOSEN CATEGORY
    rate_config = await db.rate_config.find_one({"category": bill_data.category})
    
    if not rate_config:
        # Fallback if no rate is set for this category
        rate_per_bigha = 100.0
        katha_ratio = 20.0
    else:
        rate_per_bigha = rate_config['rate_per_bigha']
        katha_ratio = rate_config['katha_to_bigha_ratio']

    # 2. CALCULATE BASED ON CATEGORY RATES
    # Total Bigha = Bigha + (Katha / Ratio)
    total_land = bill_data.land_used_bigha + (bill_data.land_used_katha / katha_ratio)
    total_amount = round(total_land * rate_per_bigha, 2)

    new_bill = {
        "consumer_id": bill_data.consumer_id,
        "category": bill_data.category, # Storing the category is vital
        "amount": total_amount,
        "paid": 0,
        "due": total_amount,
        "land_used_bigha": bill_data.land_used_bigha,
        "land_used_katha": bill_data.land_used_katha,
        "total_land_in_bigha": round(total_land, 2),
        "billing_period": bill_data.billing_period,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.bills.insert_one(new_bill)
    return {"id": str(result.inserted_id)}


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

    bill_dict.pop('_id', None)
    return bill_dict

@router.delete('/{bill_id}')
async def delete_bill(bill_id: str, request: Request):
    db = get_db(request)
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
