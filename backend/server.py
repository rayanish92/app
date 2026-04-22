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

# 1. Load Environment First
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# 2. Define ALL Models (Classes) at the top to avoid NameErrors
class RateConfigUpdate(BaseModel):
    rate_per_bigha: float
    katha_to_bigha_ratio: float

class BillSMSRequest(BaseModel):
    consumer_id: str
    land_area: str    
    amount: float      
    period: str       

# 3. Import modular routers after models if they depend on them
from routes.auth import router as auth_router
from routes.consumers import router as consumers_router
from routes.bills import router as bills_router
from routes.payments import router as payments_router
from routes.export import router as export_router
from utils.auth import hash_password, verify_password, get_current_user

# 4. Database Connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Water Tracker API")
app.state.db = db

# 5. CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://water-management-frontend-bkqh.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 6. Helper Function for Bilingual Templates
def generate_bill_templates(name, area, amount, period):
    """Generates professional bilingual message content"""
    bengali_text = (
        f"নমস্কার {name}, আপনার জলের বিল।\n"
        f"সময়কাল: {period}\n"
        f"জমির পরিমাণ: {area}\n"
        f"বিলের পরিমাণ: {amount} টাকা।\n"
        f"অনগ্রহ করে দ্রুত পরিশোধ করুন। ধন্যবাদ।"
    )
    
    english_text = (
        f"Hello {name}, your water bill.\n"
        f"Period: {period}\n"
        f"Land Area: {area}\n"
        f"Bill Amount: Rs. {amount}.\n"
        f"Please pay soon. Thank you."
    )
    
    return f"{bengali_text}\n\n---\n\n{english_text}"

# 7. Routes
app.include_router(auth_router, prefix="/api")
app.include_router(consumers_router, prefix="/api")
app.include_router(bills_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(export_router, prefix="/api")

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

@app.post('/api/sms/send-bill')
async def send_bill_notification(sms: BillSMSRequest, request: Request):
    await get_current_user(request, db)
    
    consumer = await db.consumers.find_one({'id': sms.consumer_id}, {'_id': 0})
    if not consumer:
        raise HTTPException(status_code=404, detail='Consumer not found')
    
    phone = consumer.get('phone')
    farmer_name = consumer.get('name', 'Farmer')
    full_message = generate_bill_templates(farmer_name, sms.land_area, sms.amount, sms.period)
    
    api_key = os.environ.get('FAST2SMS_API_KEY')
    whatsapp_url = f"https://wa.me/91{phone}?text={requests.utils.quote(full_message)}"
    
    if not api_key:
        return {'status': 'Key Missing', 'whatsapp_url': whatsapp_url, 'preview': full_message}

    try:
        response = requests.post(
            "https://www.fast2sms.com/dev/bulkV2",
            json={
                "route": "q",
                "message": full_message,
                "language": "unicode",
                "numbers": phone,
            },
            headers={"authorization": api_key, "Content-Type": "application/json"}
        )
        return {
            'sms_status': 'Success' if response.json().get('return') else 'Failed',
            'whatsapp_url': whatsapp_url,
            'message_sent': full_message
        }
    except Exception as e:
        return {'sms_status': 'Error', 'whatsapp_url': whatsapp_url, 'error': str(e)}

@app.get('/api/dashboard/stats')
async def get_dashboard_stats(request: Request):
    await get_current_user(request, db)
    total_consumers = await db.consumers.count_documents({})
    total_bills = await db.bills.count_documents({})
    bill_totals = await db.bills.aggregate([{'$group': {'_id': None, 'total_amount': {'$sum': '$amount'}, 'total_paid': {'$sum': '$paid'}, 'total_due': {'$sum': '$due'}}}]).to_list(1)
    totals = bill_totals[0] if bill_totals else {'total_amount': 0, 'total_paid': 0, 'total_due': 0}
    return {
        'total_consumers': total_consumers, 'total_bills': total_bills,
        'total_amount': round(totals['total_amount'], 2), 'total_paid': round(totals['total_paid'], 2), 'total_due': round(totals['total_due'], 2)
    }

# --- Logging & Startup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event('startup')
async def startup_event():
    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@waterbill.com')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'admin123')
    existing_admin = await db.users.find_one({'email': admin_email})
    if not existing_admin:
        await db.users.insert_one({
            'email': admin_email,
            'password_hash': hash_password(admin_password),
            'name': 'Admin', 'role': 'admin', 'created_at': datetime.now(timezone.utc).isoformat()
        })
    await db.users.create_index('email', unique=True)

@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()
