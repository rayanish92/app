from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
import requests
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional, List

# 1. SETUP
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# 2. MODELS (Defined at top to prevent NameErrors)
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

# 3. DATABASE
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'water_bill_tracker')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Water Tracker API")
app.state.db = db

# 4. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://water-management-frontend-bkqh.onrender.com"], 
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

# 5. ROUTERS
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

# 6. ENDPOINTS
@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get('/api/rate-config')
async def get_rate_config(request: Request):
    config = await db.rate_config.find_one({}, {'_id': 0})
    if not config:
        return {'rate_per_bigha': 100.0, 'katha_to_bigha_ratio': 20.0, 'category': 'boro chas tax'}
    return config

@app.put('/api/rate-config')
async def update_rate_config(config: RateConfigUpdate, request: Request):
    await get_current_user(request, db)
    await db.rate_config.update_one({}, {'$set': config.model_dump()}, upsert=True)
    return config.model_dump()

@app.post('/api/sms/send-bill')
async def send_bill_notification(sms: BillSMSRequest, request: Request):
    await get_current_user(request, db)
    consumer = await db.consumers.find_one({'id': sms.consumer_id})
    if not consumer: raise HTTPException(status_code=404)
    
    # Simple Bilingual Logic
    msg = f"নমস্কার {consumer['name']}, বিল বিভাগ: {sms.category}\nপরিমাণ: {sms.amount} টাকা।"
    api_key = os.environ.get('FAST2SMS_API_KEY')
    whatsapp_url = f"https://wa.me/91{consumer['phone']}?text={requests.utils.quote(msg)}"
    
    if api_key:
        requests.post("https://www.fast2sms.com/dev/bulkV2", 
            json={"route": "q", "message": msg, "language": "unicode", "numbers": consumer['phone']},
            headers={"authorization": api_key, "Content-Type": "application/json"}, timeout=10)
    
    return {'sms_status': 'Success', 'whatsapp_url': whatsapp_url}

@app.on_event('startup')
async def startup():
    await db.users.create_index('email', unique=True)
