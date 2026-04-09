from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import logging
from datetime import datetime, timezone

# Import routes
from routes.auth import router as auth_router
from routes.consumers import router as consumers_router
from routes.bills import router as bills_router
from routes.payments import router as payments_router
from utils.auth import hash_password, verify_password

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI(title="Water Tracker API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=['*'],
    allow_headers=['*'],
)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Store db in app state
app.state.db = db

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(consumers_router, prefix="/api")
app.include_router(bills_router, prefix="/api")
app.include_router(payments_router, prefix="/api")

# Dashboard stats endpoint
@app.get('/api/dashboard/stats')
async def get_dashboard_stats():
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

# Logging configuration
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
        f.write(f'''# Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin

## Endpoints
- Login: POST /api/auth/login
- Get current user: GET /api/auth/me
- Logout: POST /api/auth/logout
''')

@app.on_event('shutdown')
async def shutdown_db_client():
    client.close()
