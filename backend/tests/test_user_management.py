"""
User Management API Tests (P2 Feature)
Tests for: Admin user management - list, create, delete users
Role-based access control - admin vs standard user permissions
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://farm-water-tracker-1.preview.emergentagent.com')

# Test data prefixes for cleanup
TEST_PREFIX = "TEST_"


class TestAdminLogin:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test login with admin credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@waterbill.com", "password": "admin123"}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert data["email"] == "admin@waterbill.com"
        assert data["role"] == "admin"
        assert "access_token" in response.cookies
        print(f"Admin login successful: {data['email']}, role: {data['role']}")
    
    def test_admin_get_me(self, admin_session):
        """Test GET /api/auth/me returns admin user info"""
        response = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        
        data = response.json()
        assert data["email"] == "admin@waterbill.com"
        assert data["role"] == "admin"
        assert "name" in data
        assert "_id" in data
        print(f"Admin /me: {data['email']}, role: {data['role']}")


class TestStandardUserLogin:
    """Standard user authentication tests"""
    
    def test_create_standard_user_for_testing(self, admin_session):
        """Create a standard user for testing (if not exists)"""
        # First try to login with test user
        test_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "testuser@waterbill.com", "password": "user123"}
        )
        
        if test_response.status_code == 200:
            print("Standard test user already exists")
            return
        
        # Create the standard user
        user_data = {
            "email": "testuser@waterbill.com",
            "password": "user123",
            "name": "Test User",
            "role": "user"
        }
        response = admin_session.post(f"{BASE_URL}/api/auth/users", json=user_data)
        # Accept 200 (created) or 400 (already exists)
        assert response.status_code in [200, 400], f"Create user failed: {response.text}"
        print(f"Standard test user created/exists")
    
    def test_standard_user_login_success(self, admin_session):
        """Test login with standard user credentials"""
        # Ensure user exists first
        self.test_create_standard_user_for_testing(admin_session)
        
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "testuser@waterbill.com", "password": "user123"}
        )
        assert response.status_code == 200, f"Standard user login failed: {response.text}"
        
        data = response.json()
        assert data["email"] == "testuser@waterbill.com"
        assert data["role"] == "user"
        assert "access_token" in response.cookies
        print(f"Standard user login successful: {data['email']}, role: {data['role']}")
    
    def test_standard_user_get_me(self, standard_user_session):
        """Test GET /api/auth/me returns standard user info"""
        response = standard_user_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        
        data = response.json()
        assert data["email"] == "testuser@waterbill.com"
        assert data["role"] == "user"
        assert "name" in data
        assert "_id" in data
        print(f"Standard user /me: {data['email']}, role: {data['role']}")


class TestUserManagementAdminOnly:
    """User management endpoints - admin only access"""
    
    def test_admin_can_list_users(self, admin_session):
        """Test GET /api/auth/users returns user list for admin"""
        response = admin_session.get(f"{BASE_URL}/api/auth/users")
        assert response.status_code == 200, f"List users failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of users"
        assert len(data) >= 1, "Should have at least admin user"
        
        # Verify user structure
        for user in data:
            assert "_id" in user
            assert "email" in user
            assert "name" in user
            assert "role" in user
            assert "password_hash" not in user, "Password hash should not be exposed"
        
        # Verify admin is in the list
        admin_user = next((u for u in data if u["email"] == "admin@waterbill.com"), None)
        assert admin_user is not None, "Admin user should be in list"
        assert admin_user["role"] == "admin"
        
        print(f"Admin listed {len(data)} users")
    
    def test_standard_user_cannot_list_users(self, standard_user_session):
        """Test GET /api/auth/users returns 403 for standard user"""
        response = standard_user_session.get(f"{BASE_URL}/api/auth/users")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data
        print(f"Standard user correctly denied: {data['detail']}")
    
    def test_admin_can_create_user(self, admin_session):
        """Test POST /api/auth/users creates new user (admin only)"""
        timestamp = int(time.time())
        user_data = {
            "email": f"{TEST_PREFIX}newuser_{timestamp}@test.com",
            "password": "testpass123",
            "name": f"{TEST_PREFIX}New User {timestamp}",
            "role": "user"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/auth/users", json=user_data)
        assert response.status_code == 200, f"Create user failed: {response.text}"
        
        data = response.json()
        assert "_id" in data
        assert data["email"] == user_data["email"].lower()
        assert data["name"] == user_data["name"]
        assert data["role"] == user_data["role"]
        assert "password_hash" not in data, "Password hash should not be returned"
        
        # Verify user can login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": user_data["email"], "password": user_data["password"]}
        )
        assert login_response.status_code == 200, "Newly created user should be able to login"
        
        print(f"Admin created user: {data['email']}, id: {data['_id']}")
        return data["_id"]
    
    def test_admin_can_create_admin_user(self, admin_session):
        """Test POST /api/auth/users can create admin user"""
        timestamp = int(time.time())
        user_data = {
            "email": f"{TEST_PREFIX}newadmin_{timestamp}@test.com",
            "password": "adminpass123",
            "name": f"{TEST_PREFIX}New Admin {timestamp}",
            "role": "admin"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/auth/users", json=user_data)
        assert response.status_code == 200, f"Create admin user failed: {response.text}"
        
        data = response.json()
        assert data["role"] == "admin"
        
        print(f"Admin created admin user: {data['email']}")
    
    def test_standard_user_cannot_create_user(self, standard_user_session):
        """Test POST /api/auth/users returns 403 for standard user"""
        user_data = {
            "email": "shouldnotcreate@test.com",
            "password": "testpass",
            "name": "Should Not Create",
            "role": "user"
        }
        
        response = standard_user_session.post(f"{BASE_URL}/api/auth/users", json=user_data)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        
        print("Standard user correctly denied creating user")
    
    def test_create_user_duplicate_email_returns_400(self, admin_session):
        """Test POST /api/auth/users with duplicate email returns 400"""
        # Try to create user with existing admin email
        user_data = {
            "email": "admin@waterbill.com",
            "password": "somepass",
            "name": "Duplicate Admin",
            "role": "user"
        }
        
        response = admin_session.post(f"{BASE_URL}/api/auth/users", json=user_data)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data
        assert "already" in data["detail"].lower() or "registered" in data["detail"].lower()
        
        print(f"Duplicate email correctly rejected: {data['detail']}")
    
    def test_create_user_invalid_role_returns_400(self, admin_session):
        """Test POST /api/auth/users with invalid role returns 400"""
        user_data = {
            "email": "invalidrole@test.com",
            "password": "testpass",
            "name": "Invalid Role User",
            "role": "superadmin"  # Invalid role
        }
        
        response = admin_session.post(f"{BASE_URL}/api/auth/users", json=user_data)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        print("Invalid role correctly rejected")


class TestUserDeletion:
    """User deletion tests"""
    
    def test_admin_can_delete_user(self, admin_session):
        """Test DELETE /api/auth/users/{id} deletes user (admin only)"""
        # First create a user to delete
        timestamp = int(time.time())
        user_data = {
            "email": f"{TEST_PREFIX}todelete_{timestamp}@test.com",
            "password": "deletepass",
            "name": f"{TEST_PREFIX}To Delete {timestamp}",
            "role": "user"
        }
        
        create_response = admin_session.post(f"{BASE_URL}/api/auth/users", json=user_data)
        assert create_response.status_code == 200
        user_id = create_response.json()["_id"]
        
        # Delete the user
        delete_response = admin_session.delete(f"{BASE_URL}/api/auth/users/{user_id}")
        assert delete_response.status_code == 200, f"Delete user failed: {delete_response.text}"
        
        data = delete_response.json()
        assert "message" in data
        
        # Verify user is deleted - should not be in list
        list_response = admin_session.get(f"{BASE_URL}/api/auth/users")
        users = list_response.json()
        deleted_user = next((u for u in users if u["_id"] == user_id), None)
        assert deleted_user is None, "Deleted user should not be in list"
        
        # Verify user cannot login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": user_data["email"], "password": user_data["password"]}
        )
        assert login_response.status_code == 401, "Deleted user should not be able to login"
        
        print(f"Admin deleted user: {user_id}")
    
    def test_admin_cannot_delete_self(self, admin_session):
        """Test DELETE /api/auth/users/{id} cannot delete own account"""
        # Get admin's own ID
        me_response = admin_session.get(f"{BASE_URL}/api/auth/me")
        admin_id = me_response.json()["_id"]
        
        # Try to delete self
        delete_response = admin_session.delete(f"{BASE_URL}/api/auth/users/{admin_id}")
        assert delete_response.status_code == 400, f"Expected 400, got {delete_response.status_code}: {delete_response.text}"
        
        data = delete_response.json()
        assert "detail" in data
        assert "own" in data["detail"].lower() or "self" in data["detail"].lower() or "your" in data["detail"].lower()
        
        print(f"Admin correctly prevented from deleting self: {data['detail']}")
    
    def test_standard_user_cannot_delete_user(self, standard_user_session, admin_session):
        """Test DELETE /api/auth/users/{id} returns 403 for standard user"""
        # Get a user ID to try to delete (admin)
        me_response = admin_session.get(f"{BASE_URL}/api/auth/me")
        admin_id = me_response.json()["_id"]
        
        # Try to delete as standard user
        delete_response = standard_user_session.delete(f"{BASE_URL}/api/auth/users/{admin_id}")
        assert delete_response.status_code == 403, f"Expected 403, got {delete_response.status_code}: {delete_response.text}"
        
        print("Standard user correctly denied deleting user")
    
    def test_delete_nonexistent_user_returns_404(self, admin_session):
        """Test DELETE /api/auth/users/{id} with invalid ID returns 404"""
        fake_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but doesn't exist
        
        delete_response = admin_session.delete(f"{BASE_URL}/api/auth/users/{fake_id}")
        assert delete_response.status_code == 404, f"Expected 404, got {delete_response.status_code}: {delete_response.text}"
        
        print("Delete nonexistent user correctly returned 404")


# Fixtures
@pytest.fixture
def admin_session():
    """Create authenticated session with admin cookies"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@waterbill.com", "password": "admin123"}
    )
    if response.status_code != 200:
        pytest.fail(f"Admin authentication failed: {response.text}")
    return session


@pytest.fixture
def standard_user_session(admin_session):
    """Create authenticated session with standard user cookies"""
    # First ensure standard user exists
    test_response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "testuser@waterbill.com", "password": "user123"}
    )
    
    if test_response.status_code != 200:
        # Create the standard user
        user_data = {
            "email": "testuser@waterbill.com",
            "password": "user123",
            "name": "Test User",
            "role": "user"
        }
        create_response = admin_session.post(f"{BASE_URL}/api/auth/users", json=user_data)
        if create_response.status_code not in [200, 400]:
            pytest.fail(f"Failed to create standard user: {create_response.text}")
    
    # Now login as standard user
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "testuser@waterbill.com", "password": "user123"}
    )
    if response.status_code != 200:
        pytest.fail(f"Standard user authentication failed: {response.text}")
    return session


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_users():
    """Cleanup TEST_ prefixed users after all tests"""
    yield
    # Cleanup after tests
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@waterbill.com", "password": "admin123"}
    )
    if response.status_code == 200:
        users_response = session.get(f"{BASE_URL}/api/auth/users")
        if users_response.status_code == 200:
            users = users_response.json()
            for user in users:
                if user.get("name", "").startswith(TEST_PREFIX) or user.get("email", "").startswith(TEST_PREFIX.lower()):
                    session.delete(f"{BASE_URL}/api/auth/users/{user['_id']}")
        print("Test users cleanup completed")
