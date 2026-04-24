from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from pydantic import BaseModel
from typing import Optional
from utils.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api/bills', tags=['bills'])

class BillCreate(BaseModel):
    consumer_id: str
    category: str
    amount: float
    notes: Optional[str] = ""
    land_bigha: Optional[float] = 0.0
    land_katha: Optional[float] = 0.0
    total_land_in_bigha: Optional[float] = 0.0

def build_id_query(id_val):
    try:
        return {"_id": ObjectId(str(id_val))}
    except InvalidId:
        if str(id_val).isdigit():
            return {"$or": [{"id": id_val}, {"id": str(id_val)}, {"id": int(id_val)}]}
        return {"id": id_val}

async def update_consumer_due(db, consumer_id):
    try:
        pipeline = [
            {'$match': {'consumer_id': str(consumer_id)}},
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
        logger.error(f"Failed to update consumer due: {str(e)}")

@router.get('')
@router.get('/')
async def get_bills(request: Request):
    try:
        db = request.app.state.db
        await get_current_user(request, db)
        bills = await db.bills.find().sort('created_at', -1).to_list(length=1000)
        for b in bills:
            b['_id'] = str(b['_id'])
            if 'id' not in b: b['id'] = b['_id']
        return {'items': bills}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backend Crash: {str(e)}")

@router.post('')
@router.post('/')
async def create_bill(bill: BillCreate, request: Request):
    try:
        db = request.app.state.db
        await get_current_user(request, db)

        consumer = await db.consumers.find_one(build_id_query(bill.consumer_id))
        if not consumer:
            raise HTTPException(404, "Farmer not found")

        bill_doc = bill.model_dump()
        bill_doc['consumer_name'] = consumer.get('name', 'Unknown')
        bill_doc['paid'] = 0.0
        bill_doc['due'] = round(bill.amount, 2)
        bill_doc['amount'] = round(bill.amount, 2)
        bill_doc['created_at'] = datetime.now(timezone.utc)
        
        result = await db.bills.insert_one(bill_doc)
        await update_consumer_due(db, bill.consumer_id)

        await db.consumers.update_one(
            build_id_query(bill.consumer_id),
            {"$set": {"land_bigha": bill.land_bigha, "land_katha": bill.land_katha}}
        )
        return {"id": str(result.inserted_id), "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backend Crash: {str(e)}")

@router.put('/{bill_id}')
@router.put('/{bill_id}/')
async def update_bill(bill_id: str, bill_update: BillCreate, request: Request):
    try:
        db = request.app.state.db
        await get_current_user(request, db)

        existing_bill = await db.bills.find_one(build_id_query(bill_id))
        if not existing_bill:
            raise HTTPException(404, "Bill not found")

        paid = float(existing_bill.get('paid', 0.0))
        new_due = float(bill_update.amount) - paid
        # FIX: Removed zero clamp so reducing a bill creates a negative (Advance) due

        update_data = bill_update.model_dump()
        update_data['due'] = round(new_due, 2)
        update_data['amount'] = round(bill_update.amount, 2)

        await db.bills.update_one(build_id_query(bill_id), {"$set": update_data})
        await update_consumer_due(db, bill_update.consumer_id)

        await db.consumers.update_one(
            build_id_query(bill_update.consumer_id),
            {"$set": {"land_bigha": bill_update.land_bigha, "land_katha": bill_update.land_katha}}
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backend Crash: {str(e)}")

@router.delete('/{bill_id}')
@router.delete('/{bill_id}/')
async def delete_bill(bill_id: str, request: Request):
    try:
        db = request.app.state.db
        await get_current_user(request, db)

        bill = await db.bills.find_one(build_id_query(bill_id))
        if not bill:
            raise HTTPException(404, "Bill not found")

        await db.bills.delete_one(build_id_query(bill_id))
        await update_consumer_due(db, bill['consumer_id'])
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backend Crash: {str(e)}")
