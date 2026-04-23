from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from pydantic import BaseModel
from utils.auth import get_current_user
import logging

# Set up logging to catch exactly what goes wrong
logger = logging.getLogger(__name__)

router = APIRouter(prefix='/api/bills', tags=['bills'])

# --- SCHEMA DEFINITION ---
# Putting this here guarantees FastAPI knows exactly what data to expect, 
# preventing "Validation Errors" or missing file issues.
class BillCreate(BaseModel):
    consumer_id: str
    category: str
    land_used_bigha: float
    land_used_katha: float
    billing_period: str

def get_db(request: Request):
    return request.app.state.db

# --- HELPER: FLEXIBLE ID LOOKUP ---
# This ensures it finds the farmer regardless of if the frontend sends a MongoDB _id or a standard id
def build_id_query(id_str: str):
    try:
        return {"_id": ObjectId(id_str)}
    except InvalidId:
        return {"id": id_str}

# --- HELPER: RECALCULATE CONSUMER TOTAL DUE ---
async def update_consumer_due(db, consumer_id: str):
    try:
        pipeline = [
            {'$match': {'consumer_id': consumer_id}},
            {'$group': {'_id': None, 'total': {'$sum': '$due'}}}
        ]
        cursor = db.bills.aggregate(pipeline)
        result = await cursor.to_list(length=1)
        new_total_due = result[0]['total'] if result else 0.0
        
        await db.consumers.update_one(
            build_id_query(consumer_id),
            {'$set': {'total_due': round(new_total_due, 2)}}
        )
    except Exception as e:
        logger.error(f"Failed to update consumer due amount: {str(e)}")

# --- ENDPOINTS ---

@router.get('')
async def get_bills(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    db = get_db(request)
    await get_current_user(request, db)

    total = await db.bills.count_documents({})
    bills = await db.bills.find().sort('created_at', -1).skip(skip).limit(limit).to_list(limit)
    
    for bill in bills:
        bill['_id'] = str(bill['_id'])
        if 'id' not in bill: bill['id'] = bill['_id']

    return {
        'items': bills,
        'total': total,
        'has_more': (skip + limit) < total
    }

@router.post("")
async def create_bill(bill_data: BillCreate, request: Request):
    try:
        db = get_db(request)
        await get_current_user(request, db)
        
        # 1. FETCH RATE CAREFULLY
        rate_config = await db.rate_config.find_one({"category": bill_data.category})
        
        if not rate_config:
            rate_per_bigha = 100.0
            katha_ratio = 20.0
        else:
            # Force them to be floats in case they saved as strings in the DB
            rate_per_bigha = float(rate_config.get('rate_per_bigha', 100.0))
            katha_ratio = float(rate_config.get('katha_to_bigha_ratio', 20.0))
            
        # SAFETY GUARD: Prevent Division by Zero crash
        if katha_ratio == 0:
            katha_ratio = 20.0 

        # 2. CALCULATE
        total_land = bill_data.land_used_bigha + (bill_data.land_used_katha / katha_ratio)
        total_amount = round(total_land * rate_per_bigha, 2)

        # 3. GET CONSUMER NAME
        consumer = await db.consumers.find_one(build_id_query(bill_data.consumer_id))
        consumer_name = consumer.get('name', 'Unknown Farmer') if consumer else "Unknown Farmer"

        # 4. PREPARE DOCUMENT
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
        
        # 5. INSERT & UPDATE
        result = await db.bills.insert_one(new_bill)
        await update_consumer_due(db, bill_data.consumer_id)
        
        return {"id": str(result.inserted_id), "status": "success"}

    except Exception as e:
        # If anything breaks, print it to the server console AND send it to the frontend
        logger.error(f"CRITICAL ERROR creating bill: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backend crash: {str(e)}")

@router.put('/{bill_id}')
async def update_bill(bill_id: str, bill_data: BillCreate, request: Request):
    try:
        db = get_db(request)
        await get_current_user(request, db)

        rate_config = await db.rate_config.find_one({"category": bill_data.category})
        rate_per_bigha = float(rate_config.get('rate_per_bigha', 100.0)) if rate_config else 100.0
        katha_ratio = float(rate_config.get('katha_to_bigha_ratio', 20.0)) if rate_config else 20.0
        
        if katha_ratio == 0:
            katha_ratio = 20.0

        total_land = bill_data.land_used_bigha + (bill_data.land_used_katha / katha_ratio)
        total_amount = round(total_land * rate_per_bigha, 2)

        existing = await db.bills.find_one(build_id_query(bill_id))
        if not existing:
            raise HTTPException(404, "Bill not found in database")
        
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

        await db.bills.update_one(build_id_query(bill_id), {"$set": update_doc})
        await update_consumer_due(db, bill_data.consumer_id)
        
        return {"message": "Updated successfully"}
        
    except Exception as e:
        logger.error(f"CRITICAL ERROR updating bill: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backend crash: {str(e)}")

@router.delete('/{bill_id}')
async def delete_bill(bill_id: str, request: Request):
    try:
        db = get_db(request)
        await get_current_user(request, db)

        bill = await db.bills.find_one(build_id_query(bill_id))
        if not bill:
            raise HTTPException(status_code=404, detail='Bill not found')

        consumer_id = bill.get('consumer_id')
        await db.bills.delete_one(build_id_query(bill_id))

        if consumer_id:
            await update_consumer_due(db, consumer_id)

        return {'message': 'Bill deleted successfully'}
    except Exception as e:
        logger.error(f"CRITICAL ERROR deleting bill: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Backend crash: {str(e)}")
