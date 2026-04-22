from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
import requests
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional

from routes.auth import router as auth_router
from routes.consumers import router as consumers_router
from routes.bills import router as bills_router
from routes.payments import router as payments_router
from routes.export import router as export_router
from utils.auth import hash_password, verify_password, get_current_user

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Water Tracker API")

# Store db in app state for route access
app.state.db = db

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://water-management-frontend-bkqh.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(consumers_router, prefix="/api")
app.include_router(bills_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(export_router, prefix="/api")

# --- Rate Config ---
class RateConfigUpdate(BaseModel):
    rate_per_bigha: float
    katha_to_bigha_ratio: float

@app.get('/api/rate-config')
async def get_rate_config(request: Request):
    await get_current_user(request, db)
    config = await db.rate_config.find_one({}, {'_id': 0})
    if not config:
        config = {'rate_per_bigha': 100.0, 'katha_to_bigha_ratio': 20.0}
        await db.rate_config.insert_one(config)
        config.pop('_id', None)
    return config

@app.put('/api/rate-config')
async def update_rate_config(config: RateConfigUpdate, request: Request):
    await get_current_user(request, db)
    await db.rate_config.delete_many({})
    config_dict = config.model_dump()
    await db.rate_config.insert_one(config_dict)
    config_dict.pop('_id', None)
    return config_dict

# --- SMS / WhatsApp endpoint ---

class SMSRequest(BaseModel):
    consumer_id: str
    message: str  # Can accept Bengali or English text

@app.post('/api/sms/send')
async def send_sms(sms: SMSRequest, request: Request):
    await get_current_user(request, db)
    consumer = await db.consumers.find_one({'id': sms.consumer_id}, {'_id': 0})
    
    if not consumer:
        raise HTTPException(status_code=404, detail='Consumer not found')

    phone = consumer.get('phone')
    api_key = os.environ.get('FAST2SMS_API_KEY')

    if not api_key:
        logging.error("FAST2SMS_API_KEY is missing in environment variables")
        # Fallback to just logging if no API key is found
        return {
            'message': 'SMS key missing, but WhatsApp link generated',
            'phone': phone,
            'text': sms.message,
            'whatsapp_url': f"https://wa.me/91{phone}?text={requests.utils.quote(sms.message)}"
        }

    # Fast2SMS Bulk V2 API Configuration
    url = "https://www.fast2sms.com/dev/bulkV2"
    
    # We use route 'q' (Quick SMS). For Bengali (Unicode), 
    # Fast2SMS handles unicode characters in the message string automatically.
    payload = {
        "route": "q",
        "message": sms.message,
        "language": "unicode", # Required for Bengali characters
        "numbers": phone,
    }
    
    headers = {
        "authorization": api_key,
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        result = response.json()
        
        logging.info(f"Fast2SMS Response for {phone}: {result}")

        return {
            'sms_status': 'Success' if result.get('return') else 'Failed',
            'sms_detail': result.get('message', []),
            'whatsapp_url': f"https://wa.me/91{phone}?text={requests.utils.quote(sms.message)}",
            'phone': phone,
            'text': sms.message
        }
    except Exception as e:
        logging.error(f"SMS Sending Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to reach SMS gateway")

# --- Dashboard stats ---

@app.get('/api/dashboard/stats')
async def get_dashboard_stats(request: Request):
    await get_current_user(request, db)
    total_consumers = await db.consumers.count_documents({})
    total_bills = await db.bills.count_documents({})

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

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- Startup / Shutdown ---
@app.on_event('startup')
async def startup_event():
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

    await db.users.create_index('email', unique=True)
    await db.password_reset_tokens.create_index('expires_at', expireAfterSeconds=3600)

    credentials_path = Path("./memory")
    credentials_path.mkdir(parents=True, exist_ok=True)
    with open(credentials_path / 'test_credentials.md', 'w') as f:
        f.write(f'# Test Credentials\n\n## Admin Account\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n## Endpoints\n- Login: POST /api/auth/login\n- Get current user: GET /api/auth/me\n- Logout: POST /api/auth/logout\n')

@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()
