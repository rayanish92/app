from fastapi import APIRouter, HTTPException, Depends, Request, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from datetime import datetime, timezone
from bson import ObjectId
from ..models.schemas import Payment, PaymentCreate
from ..utils.auth import get_current_user

router = APIRouter(prefix='/payments', tags=['payments'])

def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db

@router.get('', response_model=dict)
async def get_payments(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    request: Request = None,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    await get_current_user(request, db)
    
    total = await db.payments.count_documents({})
    payments = await db.payments.find({}, {'_id': 0}).skip(skip).limit(limit).to_list(limit)
    
    return {
        'items': payments,
        'total': total,
        'skip': skip,
        'limit': limit,
        'has_more': (skip + limit) < total
    }

@router.post('')
async def create_payment(
    payment: PaymentCreate,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    await get_current_user(request, db)
    
    bill = await db.bills.find_one({'id': payment.bill_id}, {'_id': 0})
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    
    if payment.amount > bill['due']:
        raise HTTPException(status_code=400, detail='Payment amount exceeds due amount')
    
    payment_dict = {
        'id': str(ObjectId()),
        'bill_id': payment.bill_id,
        'consumer_id': bill['consumer_id'],
        'consumer_name': bill['consumer_name'],
        'amount': payment.amount,
        'payment_method': payment.payment_method,
        'notes': payment.notes or '',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.payments.insert_one(payment_dict)
    
    # Update bill
    new_paid = bill['paid'] + payment.amount
    new_due = bill['due'] - payment.amount
    await db.bills.update_one(
        {'id': payment.bill_id},
        {'$set': {'paid': round(new_paid, 2), 'due': round(new_due, 2)}}
    )
    
    # Update consumer total due
    total_due = await db.bills.aggregate([
        {'$match': {'consumer_id': bill['consumer_id']}},
        {'$group': {'_id': None, 'total': {'$sum': '$due'}}}
    ]).to_list(1)
    new_total_due = total_due[0]['total'] if total_due else 0.0
    await db.consumers.update_one(
        {'id': bill['consumer_id']},
        {'$set': {'total_due': round(new_total_due, 2)}}
    )
    
    return payment_dict

@router.put('/{payment_id}')
async def update_payment(
    payment_id: str,
    payment: PaymentCreate,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    await get_current_user(request, db)
    
    # Get old payment
    old_payment = await db.payments.find_one({'id': payment_id}, {'_id': 0})
    if not old_payment:
        raise HTTPException(status_code=404, detail='Payment not found')
    
    # Get bill
    bill = await db.bills.find_one({'id': payment.bill_id}, {'_id': 0})
    if not bill:
        raise HTTPException(status_code=404, detail='Bill not found')
    
    # Calculate difference
    amount_diff = payment.amount - old_payment['amount']
    
    # Check if new amount is valid
    if bill['due'] + old_payment['amount'] < payment.amount:
        raise HTTPException(status_code=400, detail='Payment amount exceeds bill total')
    
    # Update payment
    await db.payments.update_one(
        {'id': payment_id},
        {'$set': {
            'amount': payment.amount,
            'payment_method': payment.payment_method,
            'notes': payment.notes or ''
        }}
    )
    
    # Update bill
    new_paid = bill['paid'] + amount_diff
    new_due = bill['due'] - amount_diff
    await db.bills.update_one(
        {'id': payment.bill_id},
        {'$set': {'paid': round(new_paid, 2), 'due': round(new_due, 2)}}
    )
    
    # Update consumer total due
    total_due = await db.bills.aggregate([
        {'$match': {'consumer_id': bill['consumer_id']}},
        {'$group': {'_id': None, 'total': {'$sum': '$due'}}}
    ]).to_list(1)
    new_total_due = total_due[0]['total'] if total_due else 0.0
    await db.consumers.update_one(
        {'id': bill['consumer_id']},
        {'$set': {'total_due': round(new_total_due, 2)}}
    )
    
    return {'message': 'Payment updated successfully'}

@router.delete('/{payment_id}')
async def delete_payment(
    payment_id: str,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    await get_current_user(request, db)
    
    payment = await db.payments.find_one({'id': payment_id}, {'_id': 0})
    if not payment:
        raise HTTPException(status_code=404, detail='Payment not found')
    
    # Get bill
    bill = await db.bills.find_one({'id': payment['bill_id']}, {'_id': 0})
    if bill:
        # Reverse payment from bill
        new_paid = bill['paid'] - payment['amount']
        new_due = bill['due'] + payment['amount']
        await db.bills.update_one(
            {'id': payment['bill_id']},
            {'$set': {'paid': round(new_paid, 2), 'due': round(new_due, 2)}}
        )
        
        # Update consumer total due
        total_due = await db.bills.aggregate([
            {'$match': {'consumer_id': bill['consumer_id']}},
            {'$group': {'_id': None, 'total': {'$sum': '$due'}}}
        ]).to_list(1)
        new_total_due = total_due[0]['total'] if total_due else 0.0
        await db.consumers.update_one(
            {'id': bill['consumer_id']},
            {'$set': {'total_due': round(new_total_due, 2)}}
        )
    
    # Delete payment
    await db.payments.delete_one({'id': payment_id})
    
    return {'message': 'Payment deleted successfully'}
