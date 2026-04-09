from fastapi import APIRouter, HTTPException, Response, Request
from bson import ObjectId
from datetime import datetime, timezone
from models.schemas import LoginRequest, UserCreate
from utils.auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user
)

router = APIRouter(prefix='/auth', tags=['auth'])


def get_db(request: Request):
    return request.app.state.db


@router.post('/login')
async def login(login_req: LoginRequest, response: Response, request: Request):
    db = get_db(request)
    user = await db.users.find_one({'email': login_req.email.lower()})
    if not user or not verify_password(login_req.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')

    user_id = str(user['_id'])
    access_token = create_access_token(user_id, user['email'])
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(
        key='access_token', value=access_token,
        httponly=True, secure=False, samesite='lax',
        max_age=3600, path='/'
    )
    response.set_cookie(
        key='refresh_token', value=refresh_token,
        httponly=True, secure=False, samesite='lax',
        max_age=604800, path='/'
    )

    return {
        '_id': user_id,
        'email': user['email'],
        'name': user['name'],
        'role': user['role']
    }


@router.post('/logout')
async def logout(response: Response, request: Request):
    db = get_db(request)
    await get_current_user(request, db)
    response.delete_cookie('access_token', path='/')
    response.delete_cookie('refresh_token', path='/')
    return {'message': 'Logged out successfully'}


@router.get('/me')
async def get_me(request: Request):
    db = get_db(request)
    return await get_current_user(request, db)


# --- User Management (Admin only) ---

@router.get('/users')
async def list_users(request: Request):
    db = get_db(request)
    current_user = await get_current_user(request, db)
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')

    users = await db.users.find({}, {'password_hash': 0}).to_list(100)
    for u in users:
        u['_id'] = str(u['_id'])
    return users


@router.post('/users')
async def create_user(user_data: UserCreate, request: Request):
    db = get_db(request)
    current_user = await get_current_user(request, db)
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')

    if user_data.role not in ('admin', 'user'):
        raise HTTPException(status_code=400, detail='Role must be admin or user')

    existing = await db.users.find_one({'email': user_data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')

    hashed = hash_password(user_data.password)
    user_doc = {
        'email': user_data.email.lower(),
        'password_hash': hashed,
        'name': user_data.name,
        'role': user_data.role,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    return {
        '_id': str(result.inserted_id),
        'email': user_doc['email'],
        'name': user_doc['name'],
        'role': user_doc['role']
    }


@router.delete('/users/{user_id}')
async def delete_user(user_id: str, request: Request):
    db = get_db(request)
    current_user = await get_current_user(request, db)
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')

    if current_user['_id'] == user_id:
        raise HTTPException(status_code=400, detail='Cannot delete your own account')

    result = await db.users.delete_one({'_id': ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='User not found')
    return {'message': 'User deleted successfully'}
