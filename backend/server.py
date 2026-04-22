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

# --- 2. DATA MODELS (Defined at top to avoid NameErrors) ---
class RateConfigUpdate(BaseModel):
    rate_per_bigha: float
    katha_to_bigha_ratio: float
    category: Optional[str] = "boro chas tax"

class BillSMSRequest(BaseModel):
    consumer_id: str
    land_area: str    
    amount: float      
    period: str       
    category: str 

class SMSRequest(BaseModel):
    consumer_id: str
    message: str

# --- 3. DATABASE CONNECTION ---
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'water_billing') # Ensure this matches Atlas!

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Water Tracker API")
app.state.db = db

# --- 4. ERROR HANDLING & CORS ---
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"422 Validation Error: {exc.errors()}")
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

# --- 5. BILINGUAL MESSAGE GENERATOR ---
def generate_bill_templates(name, area, amount, period, category):
    cat_map = {
        "boro chas tax": "বোরো চাষ ট্যাক্স",
        "boro seed water tax": "বোরো বীজ জল ট্যাক্স",
        "potato water tax": "আলু জল ট্যাক্স",
        "mustard water tax": "সরষে জল ট্যাক্স",
        "others water tax": "অন্যান্য জল ট্যাক্স"
    }
    clean_cat = category.lower() if category else "others water tax"
    bengali_cat = cat_map.get(clean_cat, "জলের ট্যাক্স")

    bengali_text = (
        f"নমস্কার {name}, আপনার জলের বিল।\n"
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
        f"Land Area: {area}\n"
        f"Amount: Rs. {amount}."
    )
    
    return f"{bengali_text}\n\n---\n\n{english_text}"

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

# --- 7. CUSTOM ENDPOINTS ---

@app.get("/")
@app.get("/health")
async def health():
    return {"status": "ok", "db": DB_NAME}

@app.get('/api/dashboard/stats')
async def get_dashboard_stats(request: Request):
    try:
        await get_current_user(request, db)
        
        c_count = await db.consumers.count_documents({})
        b_count = await db.bills.count_documents({})
        
        # Aggregation with string-to-double conversion for safety
        pipeline = [
            { '$project': {
                'amount': { '$toDouble': '$amount' },
                'paid': { '$toDouble': '$paid' },
                'due': { '$toDouble': '$due' }
            }},
            { '$group': {
                '_id': None,
                'total_amount': { '$sum': '$amount' },
                'total_paid': { '$sum': '$paid' },
                'total_due': { '$sum': '$due' }
            }}
        ]
        
        totals_res = await db.bills.aggregate(pipeline).to_list(1)
        res = totals_res[0] if totals_res else {}

        return {
            'total_consumers': c_count,
            'total_bills': b_count,
            'total_amount': round(res.get('total_amount', 0), 2),
            'total_paid': round(res.get('total_paid', 0), 2),
            'total_due': round(res.get('total_due', 0), 2)
        }
    except Exception as e:
        logger.error(f"Stats Error: {e}")
        return {'total_consumers': 0, 'total_bills': 0, 'total_amount': 0, 'total_paid': 0, 'total_due': 0}

@app.get('/api/rate-config')
async def get_rate_config(request: Request):
    config = await db.rate_config.find_one({}, {'_id': 0})
    if not config:
        return {'rate_per_bigha': 100.0, 'katha_to_bigha_ratio': 20.0, 'category': 'boro chas tax'}
    return config

@app.put('/api/rate-config')
async def update_rate_config(config: RateConfigUpdate, request: Request):
    await get_current_user(request, db)
    # Upsert by category to support different rates for potato, mustard, etc.
    await db.rate_config.update_one(
        {'category': config.category},
        {'$set': config.model_dump()},
        upsert=True
    )
    return config.model_dump()

@app.post('/api/sms/send-bill')
async def send_bill_notification(sms: BillSMSRequest, request: Request):
    await get_current_user(request, db)
    consumer = await db.consumers.find_one({'id': sms.consumer_id})
    if not consumer: raise HTTPException(status_code=404)
    
    msg = generate_bill_templates(consumer['name'], sms.land_area, sms.amount, sms.period, sms.category)
    api_key = os.environ.get('FAST2SMS_API_KEY')
    whatsapp_url = f"https://wa.me/91{consumer['phone']}?text={requests.utils.quote(msg)}"
    
    if api_key:
        requests.post("https://www.fast2sms.com/dev/bulkV2", 
            json={"route": "q", "message": msg, "language": "unicode", "numbers": consumer['phone']},
            headers={"authorization": api_key, "Content-Type": "application/json"}, timeout=10)
    
    return {'sms_status': 'Success', 'whatsapp_url': whatsapp_url}

# --- 8. LIFECYCLE ---
@app.on_event('startup')
async def startup():
    await db.users.create_index('email', unique=True)
    logger.info("Server started successfully.")

@app.on_event('shutdown')
async def shutdown():
    client.close()
