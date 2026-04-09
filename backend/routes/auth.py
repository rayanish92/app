from fastapi import APIRouter, HTTPException, Response, Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from ..models.schemas import LoginRequest
from ..utils.auth import hash_password, verify_password, create_access_token, create_refresh_token, get_current_user

router = APIRouter(prefix='/auth', tags=['auth'])

def get_db(request: Request) -> AsyncIOMotorDatabase:
    return request.app.state.db

@router.post('/login')
async def login(request: LoginRequest, response: Response, db: AsyncIOMotorDatabase = Depends(get_db)):
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

@router.post('/logout')
async def logout(response: Response, request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    current_user = await get_current_user(request, db)
    response.delete_cookie('access_token', path='/')
    response.delete_cookie('refresh_token', path='/')
    return {'message': 'Logged out successfully'}

@router.get('/me')
async def get_me(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    return await get_current_user(request, db)
