from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from pydantic import BaseModel
from typing import Optional
from utils.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/api/payments', tags=['payments'])

class PaymentCreate(BaseModel):
    bill_id: str
    amount: float
    payment_method: str
    category: str
    notes: Optional[str] = ""

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
async def get_payments(request: Request):
    try:
        db = request.app.state.db
        await get_current_user(request, db)
        payments = await db.payments.find().sort('created_at', -1).to_list(length=1000)
        for p in payments:
            p['_id'] = str(p['_id'])
            if 'id' not in p: p['id'] = p['_id']
        return {'items': payments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backend Crash: {str(e)}")

@router.post('')
@router.post('/')
async def create_payment(payment: PaymentCreate, request: Request):
    try:
        db = request.app.state.db
        await get_current_user(request, db)

        bill = await db.bills.find_one(build_id_query(payment.bill_id))
        if not bill:
            raise HTTPException(404, "Bill not found in database! Please refresh the page.")

        current_paid = float(bill.get('paid', 0.0))
        total_amount = float(bill.get('amount', 0.0))
        
        new_paid = current_paid + payment.amount
        new_due = total_amount - new_paid
        # FIX: Removed the zero clamp so it can go negative!

        await db.bills.update_one(
            build_id_query(payment.bill_id),
            {"$set": {"paid": round(new_paid, 2), "due": round(new_due, 2)}}
        )

        payment_doc = payment.model_dump()
        payment_doc['consumer_id'] = bill.get('consumer_id')
        payment_doc['consumer_name'] = bill.get('consumer_name', 'Unknown Farmer')
        payment_doc['created_at'] = datetime.now(timezone.utc)
        
        result = await db.payments.insert_one(payment_doc)

        if bill.get('consumer_id'):
            await update_consumer_due(db, bill.get('consumer_id'))

        return {"id": str(result.inserted_id), "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backend Crash: {str(e)}")

@router.put('/{payment_id}')
@router.put('/{payment_id}/')
async def update_payment(payment_id: str, payment_update: PaymentCreate, request: Request):
    try:
        db = request.app.state.db
        await get_current_user(request, db)
        
        old_payment = await db.payments.find_one(build_id_query(payment_id))
        if not old_payment: raise HTTPException(404, "Payment not found")

        # FIX: Calculate exact difference and apply it to the bill
        old_amount = float(old_payment.get('amount', 0))
        new_amount = float(payment_update.amount)
        difference = new_amount - old_amount

        # Update Payment Record
        await db.payments.update_one(build_id_query(payment_id), {"$set": payment_update.model_dump()})
        
        # Update Connected Bill
        bill = await db.bills.find_one(build_id_query(payment_update.bill_id))
        if bill:
            new_paid = float(bill.get('paid', 0)) + difference
            new_due = float(bill.get('amount', 0)) - new_paid
            
            await db.bills.update_one(
                build_id_query(payment_update.bill_id),
                {"$set": {"paid": round(new_paid, 2), "due": round(new_due, 2)}}
            )
            if bill.get('consumer_id'):
                await update_consumer_due(db, bill.get('consumer_id'))

        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backend Crash: {str(e)}")

@router.delete('/{payment_id}')
@router.delete('/{payment_id}/')
async def delete_payment(payment_id: str, request: Request):
    try:
        db = request.app.state.db
        await get_current_user(request, db)

        payment = await db.payments.find_one(build_id_query(payment_id))
        if not payment:
            raise HTTPException(404, "Payment not found")

        bill = await db.bills.find_one(build_id_query(payment['bill_id']))
        if bill:
            new_paid = float(bill.get('paid', 0)) - float(payment['amount'])
            new_due = float(bill.get('amount', 0)) - new_paid
            # FIX: Removed zero clamp
            await db.bills.update_one(
                build_id_query(payment['bill_id']),
                {"$set": {"paid": round(new_paid, 2), "due": round(new_due, 2)}}
            )
            if bill.get('consumer_id'):
                await update_consumer_due(db, bill.get('consumer_id'))

        await db.payments.delete_one(build_id_query(payment_id))
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backend Crash: {str(e)}")
