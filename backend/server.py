from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this')
JWT_ALGORITHM = 'HS256'

# Fast2SMS Config (optional)
FAST2SMS_API_KEY = os.environ.get('FAST2SMS_API_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Password hashing functions
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# JWT functions
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        'sub': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(minutes=60),
        'type': 'access'
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=7),
        'type': 'refresh'
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Get current user dependency
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get('access_token')
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get('type') != 'access':
            raise HTTPException(status_code=401, detail='Invalid token type')
        user = await db.users.find_one({'_id': ObjectId(payload['sub'])})
        if not user:
            raise HTTPException(status_code=401, detail='User not found')
        user['_id'] = str(user['_id'])
        user.pop('password_hash', None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

# Models
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str = Field(alias='_id')
    email: str
    name: str
    role: str

    model_config = ConfigDict(populate_by_name=True)

class ConsumerCreate(BaseModel):
    name: str
    phone: str
    address: Optional[str] = ''
    land_bigha: float = 0.0
    land_katha: float = 0.0

class Consumer(BaseModel):
    id: str
    name: str
    phone: str
    address: str
    land_bigha: float
    land_katha: float
    total_due: float = 0.0
    created_at: str

class RateConfigUpdate(BaseModel):
    rate_per_bigha: float
    katha_to_bigha_ratio: float

class RateConfig(BaseModel):
    rate_per_bigha: float
    katha_to_bigha_ratio: float

class BillCreate(BaseModel):
    consumer_id: str
    land_used_bigha: float
    land_used_katha: float
    billing_period: str

class Bill(BaseModel):
    id: str
    consumer_id: str
    consumer_name: str
    land_used_bigha: float
    land_used_katha: float
    total_land_in_bigha: float
    amount: float
    paid: float
    due: float
    billing_period: str
    created_at: str

class PaymentCreate(BaseModel):
    bill_id: str
    amount: float
    payment_method: str = 'cash'
    notes: Optional[str] = ''

class Payment(BaseModel):
    id: str
    bill_id: str
    consumer_id: str
    consumer_name: str
    amount: float
    payment_method: str
    notes: str
    created_at: str

class SMSRequest(BaseModel):
    consumer_id: str
    message: str

# Auth endpoints
@api_router.post('/auth/login')
async def login(request: LoginRequest, response: Response):
    user = await db.users.find_one({'email': request.email.lower()})
    if not user or not verify_password(request.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    
    user_id = str(user['_id'])
    access_token = create_access_token(user_id, user['email'])
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(
        key='access_token',
        value=access_token,
        httponly=True,
        secure=False,
        samesite='lax',
        max_age=3600,
        path='/'
    )
    response.set_cookie(
        key='refresh_token',
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite='lax',
        max_age=604800,
        path='/'
    )
    
    return {
        '_id': user_id,
        'email': user['email'],
        'name': user['name'],
        'role': user['role']
    }

@api_router.post('/auth/logout')
async def logout(response: Response, current_user: dict = Depends(get_current_user)):
    response.delete_cookie('access_token', path='/')
    response.delete_cookie('refresh_token', path='/')
    return {'message': 'Logged out successfully'}

@api_router.get('/auth/me')
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# Consumer endpoints
@api_router.get('/consumers', response_model=List[Consumer])
async def get_consumers(current_user: dict = Depends(get_current_user)):
    consumers = await db.consumers.find({}, {'_id': 0}).to_list(1000)
    return consumers

@api_router.post('/consumers')
async def create_consumer(consumer: ConsumerCreate, current_user: dict = Depends(get_current_user)):
    consumer_dict = consumer.model_dump()
    consumer_dict['id'] = str(ObjectId())
    consumer_dict['total_due'] = 0.0
    consumer_dict['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.consumers.insert_one(consumer_dict)
    # Remove MongoDB _id before returning
    consumer_dict.pop('_id', None)
    return consumer_dict

@api_router.put('/consumers/{consumer_id}')
async def update_consumer(consumer_id: str, consumer: ConsumerCreate, current_user: dict = Depends(get_current_user)):
    result = await db.consumers.update_one(
        {'id': consumer_id},
        {'$set': consumer.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Consumer not found')
    return {'message': 'Consumer updated successfully'}

@api_router.delete('/consumers/{consumer_id}')
async def delete_consumer(consumer_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.consumers.delete_one({'id': consumer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Consumer not found')
    return {'message': 'Consumer deleted successfully'}

# Rate config endpoints
@api_router.get('/rate-config', response_model=RateConfig)
async def get_rate_config(current_user: dict = Depends(get_current_user)):
    config = await db.rate_config.find_one({}, {'_id': 0})
    if not config:
        config = {'rate_per_bigha': 100.0, 'katha_to_bigha_ratio': 20.0}
        await db.rate_config.insert_one(config)
    return config

@api_router.put('/rate-config')
async def update_rate_config(config: RateConfigUpdate, current_user: dict = Depends(get_current_user)):
    await db.rate_config.delete_many({})
    await db.rate_config.insert_one(config.model_dump())
    return config

# Bill endpoints
@api_router.get('/bills', response_model=List[Bill])
async def get_bills(current_user: dict = Depends(get_current_user)):
    bills = await db.bills.find({}, {'_id': 0}).to_list(1000)
    return bills

@api_router.post('/bills')
async def create_bill(bill: BillCreate, current_user: dict = Depends(get_current_user)):
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
    
    # Remove MongoDB _id before returning
    bill_dict.pop('_id', None)
    return bill_dict

@api_router.delete('/bills/{bill_id}')
async def delete_bill(bill_id: str, current_user: dict = Depends(get_current_user)):
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

# Payment endpoints
@api_router.get('/payments', response_model=List[Payment])
async def get_payments(current_user: dict = Depends(get_current_user)):
    payments = await db.payments.find({}, {'_id': 0}).to_list(1000)
    return payments

@api_router.post('/payments')
async def create_payment(payment: PaymentCreate, current_user: dict = Depends(get_current_user)):
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
    
    # Remove MongoDB _id before returning
    payment_dict.pop('_id', None)
    return payment_dict


@api_router.put('/payments/{payment_id}')
async def update_payment(payment_id: str, payment: PaymentCreate, current_user: dict = Depends(get_current_user)):
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

@api_router.delete('/payments/{payment_id}')
async def delete_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
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

# SMS endpoint
@api_router.post('/sms/send')
async def send_sms(sms: SMSRequest, current_user: dict = Depends(get_current_user)):
    consumer = await db.consumers.find_one({'id': sms.consumer_id}, {'_id': 0})
    if not consumer:
        raise HTTPException(status_code=404, detail='Consumer not found')
    
    # Fast2SMS Integration
    fast2sms_api_key = os.environ.get('FAST2SMS_API_KEY', '')
    
    if not fast2sms_api_key:
        # Log SMS instead of sending (for demo)
        logging.info(f"SMS to {consumer['phone']}: {sms.message}")
        return {'message': 'SMS logged (Fast2SMS not configured)', 'phone': consumer['phone'], 'text': sms.message}
    
    try:
        import requests
        from urllib.parse import urlencode
        
        # Fast2SMS API endpoint - use /dev/bulk (not bulkV2)
        url = "https://www.fast2sms.com/dev/bulk"
        
        # Prepare payload with proper URL encoding
        # Route 'q' = Quick SMS (non-DLT, for testing)
        payload = {
            'message': sms.message,
            'language': 'english',
            'route': 'q',
            'numbers': consumer['phone']
        }
        
        headers = {
            'authorization': fast2sms_api_key,
            'Content-Type': "application/x-www-form-urlencoded",
            'Cache-Control': "no-cache"
        }
        
        # Send SMS
        logging.info(f"Sending SMS to {consumer['phone']} via Fast2SMS")
        logging.info(f"Payload: {payload}")
        
        response = requests.post(url, data=payload, headers=headers, timeout=30)
        
        logging.info(f"Fast2SMS status code: {response.status_code}")
        logging.info(f"Fast2SMS response: {response.text}")
        
        # Check response
        if response.status_code == 200:
            result = response.json()
            return {
                'message': 'SMS sent successfully via Fast2SMS',
                'response': result,
                'phone': consumer['phone']
            }
        else:
            error_msg = f"Fast2SMS API error: {response.status_code} - {response.text}"
            logging.error(error_msg)
            # Return error details to help debug
            return {
                'message': f'SMS failed: {response.text}',
                'status_code': response.status_code,
                'error': response.text
            }
        
    except Exception as e:
        logging.error(f"Fast2SMS exception: {str(e)}")
        raise HTTPException(status_code=500, detail=f'Failed to send SMS: {str(e)}')

# Dashboard stats
@api_router.get('/dashboard/stats')
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    total_consumers = await db.consumers.count_documents({})
    total_bills = await db.bills.count_documents({})
    
    # Total amount and due
    bill_totals = await db.bills.aggregate([
        {'$group': {
            '_id': None,
            'total_amount': {'$sum': '$amount'},
            'total_paid': {'$sum': '$paid'},
            'total_due': {'$sum': '$due'}
        }}
    ]).to_list(1)
    
    totals = bill_totals[0] if bill_totals else {'total_amount': 0, 'total_paid': 0, 'total_due': 0}
    
    return {
        'total_consumers': total_consumers,
        'total_bills': total_bills,
        'total_amount': round(totals['total_amount'], 2),
        'total_paid': round(totals['total_paid'], 2),
        'total_due': round(totals['total_due'], 2)
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=['*'],
    allow_headers=['*'],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event('startup')
async def startup_event():
    # Seed admin user
    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@waterbill.com')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'admin123')
    
    existing_admin = await db.users.find_one({'email': admin_email})
    if not existing_admin:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            'email': admin_email,
            'password_hash': hashed,
            'name': 'Admin',
            'role': 'admin',
            'created_at': datetime.now(timezone.utc).isoformat()
        })
        logger.info(f'Admin user created: {admin_email}')
    elif not verify_password(admin_password, existing_admin['password_hash']):
        await db.users.update_one(
            {'email': admin_email},
            {'$set': {'password_hash': hash_password(admin_password)}}
        )
        logger.info('Admin password updated')
    
    # Create indexes
    await db.users.create_index('email', unique=True)
    
    # Write test credentials
    credentials_path = Path('/app/memory')
    credentials_path.mkdir(exist_ok=True)
    with open(credentials_path / 'test_credentials.md', 'w') as f:
        f.write(f'''# Test Credentials\n\n## Admin Account\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n## Endpoints\n- Login: POST /api/auth/login\n- Get current user: GET /api/auth/me\n- Logout: POST /api/auth/logout\n''')

@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()