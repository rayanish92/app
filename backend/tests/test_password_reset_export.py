"""
Password Reset & Export API Tests (P3 Features)
Tests for:
1. Password reset flow (forgot-password, reset-password, admin reset)
2. Data export endpoints (CSV for consumers/bills/payments)
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://farm-water-tracker-1.preview.emergentagent.com')

# Test data prefixes for cleanup
TEST_PREFIX = "TEST_"


# ============ PASSWORD RESET TESTS ============

class TestForgotPassword:
    """Forgot password endpoint tests"""
    
    def test_forgot_password_existing_email(self, admin_session):
        """Test POST /api/auth/forgot-password with existing email returns success"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": "admin@waterbill.com"}
        )
        assert response.status_code == 200, f"Forgot password failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        # Should return generic message to prevent email enumeration
        assert "email" in data["message"].lower() or "reset" in data["message"].lower()
        print(f"Forgot password response: {data['message']}")
    
    def test_forgot_password_nonexistent_email(self):
        """Test POST /api/auth/forgot-password with non-existent email still returns success (security)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": "nonexistent@example.com"}
        )
        # Should return 200 to prevent email enumeration
        assert response.status_code == 200, f"Expected 200 for security, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        print(f"Non-existent email response (security): {data['message']}")
    
    def test_forgot_password_invalid_email_format(self):
        """Test POST /api/auth/forgot-password with invalid email format"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": "not-an-email"}
        )
        # Should return 422 for validation error
        assert response.status_code == 422, f"Expected 422 for invalid email, got {response.status_code}"
        print("Invalid email format correctly rejected")


class TestResetPassword:
    """Reset password endpoint tests"""
    
    def test_reset_password_invalid_token(self):
        """Test POST /api/auth/reset-password with invalid token returns error"""
        response = requests.post(
            f"{BASE_URL}/api/auth/reset-password",
            json={"token": "invalid-token-12345", "new_password": "newpass123"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid token, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data
        assert "invalid" in data["detail"].lower() or "expired" in data["detail"].lower()
        print(f"Invalid token correctly rejected: {data['detail']}")
    
    def test_reset_password_empty_token(self):
        """Test POST /api/auth/reset-password with empty token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/reset-password",
            json={"token": "", "new_password": "newpass123"}
        )
        # Should return 400 or 422
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print("Empty token correctly rejected")


class TestAdminResetPassword:
    """Admin reset password endpoint tests"""
    
    def test_admin_can_reset_user_password(self, admin_session):
        """Test PUT /api/auth/users/{id}/reset-password allows admin to reset password"""
        # First create a test user
        timestamp = int(time.time())
        user_data = {
            "email": f"{TEST_PREFIX}resetpw_{timestamp}@test.com",
            "password": "oldpassword123",
            "name": f"{TEST_PREFIX}Reset PW User {timestamp}",
            "role": "user"
        }
        
        create_response = admin_session.post(f"{BASE_URL}/api/auth/users", json=user_data)
        assert create_response.status_code == 200, f"Create user failed: {create_response.text}"
        user_id = create_response.json()["_id"]
        
        # Reset the password
        new_password = "newpassword456"
        reset_response = admin_session.put(
            f"{BASE_URL}/api/auth/users/{user_id}/reset-password",
            json={"new_password": new_password}
        )
        assert reset_response.status_code == 200, f"Admin reset password failed: {reset_response.text}"
        
        data = reset_response.json()
        assert "message" in data
        print(f"Admin reset password response: {data['message']}")
        
        # Verify old password no longer works
        old_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": user_data["email"], "password": user_data["password"]}
        )
        assert old_login.status_code == 401, "Old password should not work after reset"
        
        # Verify new password works
        new_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": user_data["email"], "password": new_password}
        )
        assert new_login.status_code == 200, "New password should work after reset"
        
        print(f"Admin successfully reset password for user {user_id}")
        
        # Cleanup
        admin_session.delete(f"{BASE_URL}/api/auth/users/{user_id}")
    
    def test_admin_reset_password_nonexistent_user(self, admin_session):
        """Test PUT /api/auth/users/{id}/reset-password with invalid user ID returns 404"""
        fake_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but doesn't exist
        
        response = admin_session.put(
            f"{BASE_URL}/api/auth/users/{fake_id}/reset-password",
            json={"new_password": "newpass123"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("Reset password for nonexistent user correctly returned 404")
    
    def test_standard_user_cannot_reset_password(self, standard_user_session, admin_session):
        """Test PUT /api/auth/users/{id}/reset-password returns 403 for standard user"""
        # Get admin's ID
        me_response = admin_session.get(f"{BASE_URL}/api/auth/me")
        admin_id = me_response.json()["_id"]
        
        # Try to reset as standard user
        response = standard_user_session.put(
            f"{BASE_URL}/api/auth/users/{admin_id}/reset-password",
            json={"new_password": "hackedpass"}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print("Standard user correctly denied resetting password")


# ============ EXPORT TESTS ============

class TestExportConsumers:
    """Export consumers endpoint tests"""
    
    def test_export_consumers_csv(self, admin_session):
        """Test GET /api/export/consumers returns CSV file"""
        response = admin_session.get(f"{BASE_URL}/api/export/consumers")
        assert response.status_code == 200, f"Export consumers failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type, f"Expected text/csv, got {content_type}"
        
        # Check content disposition
        content_disp = response.headers.get('Content-Disposition', '')
        assert 'attachment' in content_disp, f"Expected attachment, got {content_disp}"
        assert 'consumers.csv' in content_disp, f"Expected consumers.csv in {content_disp}"
        
        # Check CSV content has headers
        content = response.text
        assert 'Name' in content, "CSV should have Name header"
        assert 'Phone' in content, "CSV should have Phone header"
        
        print(f"Export consumers CSV: {len(content)} bytes, headers present")
    
    def test_export_consumers_requires_auth(self):
        """Test GET /api/export/consumers requires authentication"""
        response = requests.get(f"{BASE_URL}/api/export/consumers")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Export consumers correctly requires authentication")


class TestExportBills:
    """Export bills endpoint tests"""
    
    def test_export_bills_csv(self, admin_session):
        """Test GET /api/export/bills returns CSV file"""
        response = admin_session.get(f"{BASE_URL}/api/export/bills")
        assert response.status_code == 200, f"Export bills failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type, f"Expected text/csv, got {content_type}"
        
        # Check content disposition
        content_disp = response.headers.get('Content-Disposition', '')
        assert 'attachment' in content_disp
        assert 'bills.csv' in content_disp
        
        # Check CSV content has headers
        content = response.text
        assert 'Consumer' in content, "CSV should have Consumer header"
        assert 'Period' in content, "CSV should have Period header"
        assert 'Amount' in content, "CSV should have Amount header"
        
        print(f"Export bills CSV: {len(content)} bytes, headers present")
    
    def test_export_bills_requires_auth(self):
        """Test GET /api/export/bills requires authentication"""
        response = requests.get(f"{BASE_URL}/api/export/bills")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Export bills correctly requires authentication")


class TestExportPayments:
    """Export payments endpoint tests"""
    
    def test_export_payments_csv(self, admin_session):
        """Test GET /api/export/payments returns CSV file"""
        response = admin_session.get(f"{BASE_URL}/api/export/payments")
        assert response.status_code == 200, f"Export payments failed: {response.text}"
        
        # Check content type
        content_type = response.headers.get('Content-Type', '')
        assert 'text/csv' in content_type, f"Expected text/csv, got {content_type}"
        
        # Check content disposition
        content_disp = response.headers.get('Content-Disposition', '')
        assert 'attachment' in content_disp
        assert 'payments.csv' in content_disp
        
        # Check CSV content has headers
        content = response.text
        assert 'Consumer' in content, "CSV should have Consumer header"
        assert 'Amount' in content, "CSV should have Amount header"
        assert 'Method' in content, "CSV should have Method header"
        
        print(f"Export payments CSV: {len(content)} bytes, headers present")
    
    def test_export_payments_requires_auth(self):
        """Test GET /api/export/payments requires authentication"""
        response = requests.get(f"{BASE_URL}/api/export/payments")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Export payments correctly requires authentication")


class TestExportStandardUser:
    """Export endpoints for standard user"""
    
    def test_standard_user_can_export_consumers(self, standard_user_session):
        """Test standard user can export consumers"""
        response = standard_user_session.get(f"{BASE_URL}/api/export/consumers")
        assert response.status_code == 200, f"Standard user export consumers failed: {response.text}"
        print("Standard user can export consumers")
    
    def test_standard_user_can_export_bills(self, standard_user_session):
        """Test standard user can export bills"""
        response = standard_user_session.get(f"{BASE_URL}/api/export/bills")
        assert response.status_code == 200, f"Standard user export bills failed: {response.text}"
        print("Standard user can export bills")
    
    def test_standard_user_can_export_payments(self, standard_user_session):
        """Test standard user can export payments"""
        response = standard_user_session.get(f"{BASE_URL}/api/export/payments")
        assert response.status_code == 200, f"Standard user export payments failed: {response.text}"
        print("Standard user can export payments")


# ============ FIXTURES ============

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
