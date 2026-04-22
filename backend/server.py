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

# 1. SETUP LOGGING
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 2. LOAD ENVIRONMENT
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# 3. DEFINE MODELS
class RateConfigUpdate(BaseModel):
    rate_per_bigha: float
    katha_to_bigha_ratio: float
    category: str 

class BillSMSRequest(BaseModel):
    consumer_id: str
    land_area: str    
    amount: float      
    period: str       
    category: str 

# 4. DATABASE CONNECTION
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'water_billing')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Water Tracker API")
app.state.db = db

# 5. CORS CONFIGURATION
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://water-management-frontend-bkqh.onrender.com"], 
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# 6. BILINGUAL SMS LOGIC
def generate_bill_templates(name, area, amount, period, category):
    cat_map = {
        "boro chas tax": "বোরো চাষ ট্যাক্স",
        "boro seed water tax": "বোরো বীজ জল ট্যাক্স",
        "potato water tax": "আলু জল ট্যাক্স",
        "mustard water tax": "সরষে জল ট্যাক্স",
        "others water tax": "অন্যান্য জল ট্যাক্স"
    }
    clean_cat = category.lower() if category else "others water tax"
    bengali_cat = cat_map.get(clean_cat, clean_cat)

    bengali_text = (
        f"নমস্কার {name}, আপনার জলের বিল।\n"
        f"বিভাগ: {bengali_cat}\n"
        f"সময়কাল: {period}\n"
        f"জমির পরিমাণ: {area}\n"
        f"বিলের পরিমাণ: {amount} টাকা।\n"
        f"অনগ্রহ করে দ্রুত পরিশোধ করুন। ধন্যবাদ।"
    )
    
    english_text = (
        f"Hello {name}, your water bill.\n"
        f"Category: {clean_cat.title()}\n"
        f"Period: {period}\n"
        f"Land Area: {area}\n"
        f"Bill Amount: Rs. {amount}.\n"
        f"Please pay soon. Thank you."
    )
    
    return f"{bengali_text}\n\n---\n\n{english_text}"

# 7. ROUTER IMPORTS
from routes.auth import router as auth_router
from routes.consumers import router as consumers_router
from routes.bills import router as bills_router
from routes.payments import router as payments_router
from routes.export import router as export_router
from utils.auth import hash_password, verify_password, get_current_user

app.include_router(auth_router, prefix="/api")
app.include_router(consumers_router, prefix="/api")
app.include_router(bills_router, prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(export_router, prefix="/api")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# --- FIXED: MULTI-CATEGORY RATE CONFIG ---

@app.get('/api/rate-config')
async def get_rate_config(request: Request, category: Optional[str] = None):
    await get_current_user(request, db)
    
    # If a specific category is requested, find it. Otherwise, find all.
    if category:
        config = await db.rate_config.find_one({'category': category}, {'_id': 0})
        if not config:
            return {'rate_per_bigha': 100.0, 'katha_to_bigha_ratio': 20.0, 'category': category}
        return config
    
    # Return all rates as a list
    configs = await db.rate_config.find({}, {'_id': 0}).to_list(length=20)
    return configs

@app.put('/api/rate-config')
async def update_rate_config(config: RateConfigUpdate, request: Request):
    await get_current_user(request, db)
    
    # Update only the specific category instead of deleting all
    config_dict = config.model_dump()
    result = await db.rate_config.update_one(
        {'category': config.category},
        {'$set': config_dict},
        upsert=True
    )
    
    logger.info(f"Rate updated for {config.category}")
    return config_dict

# --- SMS & DASHBOARD (Remains the same) ---

@app.post('/api/sms/send-bill')
async def send_bill_notification(sms: BillSMSRequest, request: Request):
    await get_current_user(request, db)
    consumer = await db.consumers.find_one({'id': sms.consumer_id}, {'_id': 0})
    if not consumer:
        raise HTTPException(status_code=404, detail='Consumer not found')
    
    phone = consumer.get('phone')
    full_message = generate_bill_templates(consumer.get('name', 'Farmer'), sms.land_area, sms.amount, sms.period, sms.category)
    api_key = os.environ.get('FAST2SMS_API_KEY')
    whatsapp_url = f"https://wa.me/91{phone}?text={requests.utils.quote(full_message)}"
    
    if not api_key:
        return {'status': 'Key Missing', 'whatsapp_url': whatsapp_url, 'preview': full_message}

    try:
        response = requests.post(
            "https://www.fast2sms.com/dev/bulkV2",
            json={"route": "q", "message": full_message, "language": "unicode", "numbers": phone},
            headers={"authorization": api_key, "Content-Type": "application/json"},
            timeout=10
        )
        return {'sms_status': 'Success' if response.json().get('return') else 'Failed', 'whatsapp_url': whatsapp_url}
    except Exception as e:
        return {'sms_status': 'Error', 'whatsapp_url': whatsapp_url, 'error': str(e)}

@app.get('/api/dashboard/stats')
async def get_dashboard_stats(request: Request):
    await get_current_user(request, db)
    total_consumers = await db.consumers.count_documents({})
    bill_totals = await db.bills.aggregate([{'$group': {'_id': None, 'total_amount': {'$sum': '$amount'}, 'total_paid': {'$sum': '$paid'}, 'total_due': {'$sum': '$due'}}}]).to_list(1)
    totals = bill_totals[0] if bill_totals else {'total_amount': 0, 'total_paid': 0, 'total_due': 0}
    return {'total_consumers': total_consumers, 'total_amount': round(totals['total_amount'], 2), 'total_paid': round(totals['total_paid'], 2), 'total_due': round(totals['total_due'], 2)}

@app.on_event('startup')
async def startup_event():
    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@waterbill.com')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'admin123')
    if not await db.users.find_one({'email': admin_email}):
        await db.users.insert_one({'email': admin_email, 'password_hash': hash_password(admin_password), 'name': 'Admin', 'role': 'admin', 'created_at': datetime.now(timezone.utc).isoformat()})
    await db.users.create_index('email', unique=True)

@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()
