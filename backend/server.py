from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
import requests
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional, List

# --- 1. SETUP & LOGGING ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- 2. MASTER CATEGORY DATA ---
TAX_CATEGORIES = [
    "boro chas tax",
    "boro seed water tax",
    "potato water tax",
    "mustard water tax",
    "others water tax"
]

BENGALI_CAT_MAP = {
    "boro chas tax": "বোরো চাষ ট্যাক্স",
    "boro seed water tax": "বোরো বীজ জল ট্যাক্স",
    "potato water tax": "আলু জল ট্যাক্স",
    "mustard water tax": "সরষে জল ট্যাক্স",
    "others water tax": "অন্যান্য জল ট্যাক্স"
}

# --- 3. DATA MODELS ---
class RateConfigUpdate(BaseModel):
    rate_per_bigha: float
    rate_per_katha: float  # Added Katha rate support
    katha_to_bigha_ratio: float
    category: str 

class BillSMSRequest(BaseModel):
    consumer_id: str
    land_area: str    
    amount: float      
    period: str       
    category: str 

# --- 4. DATABASE CONNECTION ---
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'water_billing')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Water Tracker API")
app.state.db = db

# --- 5. ERROR HANDLING & CORS ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"422 Error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://water-management-frontend-bkqh.onrender.com"], 
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 6. ROUTER IMPORTS ---
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

# --- 7. BILINGUAL MESSAGE GENERATOR ---
def generate_bill_templates(name, area, amount, period, category):
    clean_cat = category.lower() if category else "others water tax"
    bengali_cat = BENGALI_CAT_MAP.get(clean_cat, "জলের ট্যাক্স")

    bengali_text = (
        f"নমস্কার {name}, আপনার বিল।\n"
        f"বিভাগ: {bengali_cat}\n"
        f"সময়কাল: {period}\n"
        f"জমির পরিমাণ: {area}\n"
        f"বিলের পরিমাণ: {amount} টাকা।\n"
        f"ধন্যবাদ।"
    )
    
    english_text = (
        f"Hello {name}, your water bill.\n"
        f"Category: {category.title()}\n"
        f"Period: {period}\n"
        f"Area: {area}\n"
        f"Amount: Rs. {amount}."
    )
    
    return f"{bengali_text}\n\n---\n\n{english_text}"

# --- 8. ENDPOINTS ---

@app.get("/")
@app.get("/health")
async def health():
    return {"status": "ok", "database": DB_NAME}

@app.get('/api/categories')
async def get_categories():
    return TAX_CATEGORIES

@app.get('/api/rate-config')
async def get_rate_config(request: Request, category: Optional[str] = None):
    target_category = category if category else TAX_CATEGORIES[0]
    config = await db.rate_config.find_one({"category": target_category}, {'_id': 0})
    
    if not config:
        return {
            'rate_per_bigha': 100.0, 
            'rate_per_katha': 5.0, 
            'katha_to_bigha_ratio': 20.0, 
            'category': target_category
        }
    return config

@app.put('/api/rate-config')
async def update_rate_config(config: RateConfigUpdate, request: Request):
    await get_current_user(request, db)
    await db.rate_config.update_one(
        {'category': config.category}, 
        {'$set': config.model_dump()}, 
        upsert=True
    )
    return config.model_dump()

@app.get('/api/dashboard/stats')
async def get_dashboard_stats(request: Request):
    await get_current_user(request, db)
    c_count = await db.consumers.count_documents({})
    b_count = await db.bills.count_documents({})
    
    pipeline = [
        {'$project': {
            'amount': {'$toDouble': '$amount'}, 
            'paid': {'$toDouble': '$paid'}, 
            'due': {'$toDouble': '$due'}
        }},
        {'$group': {
            '_id': None, 
            'total_amount': {'$sum': '$amount'}, 
            'total_paid': {'$sum': '$paid'}, 
            'total_due': {'$sum': '$due'}
        }}
    ]
    
    totals = await db.bills.aggregate(pipeline).to_list(1)
    res = totals[0] if totals else {}
    
    return {
        'total_consumers': c_count, 
        'total_bills': b_count,
        'total_amount': round(res.get('total_amount', 0), 2),
        'total_paid': round(res.get('total_paid', 0), 2),
        'total_due': round(res.get('total_due', 0), 2)
    }

@app.post('/api/sms/send-bill')
async def send_bill_notification(sms: BillSMSRequest, request: Request):
    await get_current_user(request, db)
    consumer = await db.consumers.find_one({'id': sms.consumer_id})
    if not consumer:
        raise HTTPException(status_code=404, detail="Consumer not found")
        
    msg = generate_bill_templates(consumer['name'], sms.land_area, sms.amount, sms.period, sms.category)
    api_key = os.environ.get('FAST2SMS_API_KEY')
    whatsapp_url = f"https://wa.me/91{consumer['phone']}?text={requests.utils.quote(msg)}"
    
    if api_key:
        requests.post(
            "https://www.fast2sms.com/dev/bulkV2", 
            json={"route": "q", "message": msg, "language": "unicode", "numbers": consumer['phone']},
            headers={"authorization": api_key, "Content-Type": "application/json"}, 
            timeout=10
        )
    
    return {'sms_status': 'Success', 'whatsapp_url': whatsapp_url}

@app.on_event('startup')
async def startup():
    await db.users.create_index('email', unique=True)
    logger.info("Backend Started Successfully.")
