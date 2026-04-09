from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from utils.auth import get_current_user
import csv
import io

router = APIRouter(prefix='/export', tags=['export'])


def get_db(request: Request):
    return request.app.state.db


def make_csv_response(rows, headers, filename):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )


@router.get('/consumers')
async def export_consumers(request: Request):
    db = get_db(request)
    await get_current_user(request, db)

    consumers = await db.consumers.find({}, {'_id': 0}).to_list(10000)
    headers = ['Name', 'Phone', 'Address', 'Land (Bigha)', 'Land (Katha)', 'Total Due', 'Created At']
    rows = [
        [c.get('name', ''), c.get('phone', ''), c.get('address', ''),
         c.get('land_bigha', 0), c.get('land_katha', 0),
         c.get('total_due', 0), c.get('created_at', '')]
        for c in consumers
    ]
    return make_csv_response(rows, headers, 'consumers.csv')


@router.get('/bills')
async def export_bills(request: Request):
    db = get_db(request)
    await get_current_user(request, db)

    bills = await db.bills.find({}, {'_id': 0}).to_list(10000)
    headers = ['Consumer', 'Period', 'Land (Bigha)', 'Land (Katha)', 'Total Land (Bigha)', 'Amount', 'Paid', 'Due', 'Created At']
    rows = [
        [b.get('consumer_name', ''), b.get('billing_period', ''),
         b.get('land_used_bigha', 0), b.get('land_used_katha', 0),
         b.get('total_land_in_bigha', 0), b.get('amount', 0),
         b.get('paid', 0), b.get('due', 0), b.get('created_at', '')]
        for b in bills
    ]
    return make_csv_response(rows, headers, 'bills.csv')


@router.get('/payments')
async def export_payments(request: Request):
    db = get_db(request)
    await get_current_user(request, db)

    payments = await db.payments.find({}, {'_id': 0}).to_list(10000)
    headers = ['Consumer', 'Amount', 'Method', 'Notes', 'Created At']
    rows = [
        [p.get('consumer_name', ''), p.get('amount', 0),
         p.get('payment_method', ''), p.get('notes', ''),
         p.get('created_at', '')]
        for p in payments
    ]
    return make_csv_response(rows, headers, 'payments.csv')
