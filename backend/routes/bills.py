from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone
from bson import ObjectId
from models.schemas import BillCreate
from utils.auth import get_current_user
from typing import Optional

router = APIRouter(prefix='/api/bills', tags=['bills'])

def get_db(request: Request):
    return request.app.state.db

# HELPER FUNCTION TO RECALCULATE CONSUMER TOTAL DUE
async def update_consumer_due(db, consumer_id: str):
    pipeline = [
        {'$match': {'consumer_id': consumer_id}},
        {'$group': {'_id': None, 'total': {'$sum': '$due'}}}
    ]
    cursor = db.bills.aggregate(pipeline)
    result = await cursor.to_list(length=1)
    new_total_due = result[0]['total'] if result else 0.0
    
    await db.consumers.update_one(
        {'id': consumer_id},
        {'$set': {'total_due': round(new_total_due, 2)}}
    )

@router.get('')
async def get_bills(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    db = get_db(request)
    await get_current_user(request, db)

    total = await db.bills.count_documents({})
    # Added sort by newest first and converted _id to string for frontend compatibility
    bills = await db.bills.find().sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    
    for bill in bills:
        bill['_id'] = str(bill['_id'])
        if 'id' not in bill: bill['id'] = bill['_id'] # Ensure frontend always has an ID

    return {
        'items': bills,
        'total': total,
        'has_more': (skip + limit) < total
    }

@router.post("")
async def create_bill(bill_data: BillCreate, request: Request):
    db = get_db(request)
    await get_current_user(request, db)
    
    # 1. FETCH THE SPECIFIC RATE FOR THE CHOSEN CATEGORY
    rate_config = await db.rate_config.find_one({"category": bill_data.category})
    
    if not rate_config:
        rate_per_bigha = 100.0
        katha_ratio = 20.0
    else:
        rate_per_bigha = rate_config['rate_per_bigha']
        katha_ratio = rate_config['katha_to_bigha_ratio']

    # 2. CALCULATE BASED ON CATEGORY RATES
    total_land = bill_data.land_used_bigha + (bill_data.land_used_katha / katha_ratio)
    total_amount = round(total_land * rate_per_bigha, 2)

    # 3. GET CONSUMER NAME (for easier display in frontend)
    consumer = await db.consumers.find_one({"id": bill_data.consumer_id})
    consumer_name = consumer.get('name', 'Unknown') if consumer else "Unknown"

    new_bill = {
        "consumer_id": bill_data.consumer_id,
        "consumer_name": consumer_name,
        "category": bill_data.category,
        "amount": total_amount,
        "paid": 0.0,
        "due": total_amount,
        "land_used_bigha": bill_data.land_used_bigha,
        "land_used_katha": bill_data.land_used_katha,
        "total_land_in_bigha": round(total_land, 2),
        "billing_period": bill_data.billing_period,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.bills.insert_one(new_bill)
    
    # Update consumer's global debt
    await update_consumer_due(db, bill_data.consumer_id)
    
    return {"id": str(result.inserted_id), "status": "success"}

@router.put('/{bill_id}')
async def update_bill(bill_id: str, bill_data: BillCreate, request: Request):
    db = get_db(request)
    await get_current_user(request, db)

    # 1. Fetch rates for the possibly new category
    rate_config = await db.rate_config.find_one({"category": bill_data.category})
    rate_per_bigha = rate_config['rate_per_bigha'] if rate_config else 100.0
    katha_ratio = rate_config['katha_to_bigha_ratio'] if rate_config else 20.0

    # 2. Recalculate
    total_land = bill_data.land_used_bigha + (bill_data.land_used_katha / katha_ratio)
    total_amount = round(total_land * rate_per_bigha, 2)

    # 3. Update (Logic assumes 'paid' remains unchanged during a basic edit)
    # We find existing bill to check current 'paid' amount
    existing = await db.bills.find_one({"_id": ObjectId(bill_id)})
    if not existing:
        raise HTTPException(404, "Bill not found")
    
    paid_amount = existing.get('paid', 0.0)
    new_due = round(total_amount - paid_amount, 2)

    update_doc = {
        "category": bill_data.category,
        "land_used_bigha": bill_data.land_used_bigha,
        "land_used_katha": bill_data.land_used_katha,
        "total_land_in_bigha": round(total_land, 2),
        "amount": total_amount,
        "due": new_due,
        "billing_period": bill_data.billing_period
    }

    await db.bills.update_one({"_id": ObjectId(bill_id)}, {"$set": update_doc})
    await update_consumer_due(db, bill_data.consumer_id)
    
    return {"message": "Updated successfully"}

@router.delete('/{bill_id}')
async def delete_bill(bill_id: str, request: Request):
    db = get_db(request)
    await get_current_user(request, db)

    # Search by MongoDB ObjectId
    bill = await db.bills.find_one({'_id': ObjectId(bill_id)})
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')

    consumer_id = bill['consumer_id']
    await db.bills.delete_one({'_id': ObjectId(bill_id)})

    # Update consumer total due
    await update_consumer_due(db, consumer_id)

    return {'message': 'Bill deleted successfully'}
