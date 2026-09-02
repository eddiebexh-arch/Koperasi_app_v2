import os
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

def test_auth_and_core_persistence():
    s = requests.Session()
    login = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@makekal.id", "password": "SawitMakekal2026!"}, timeout=20)
    assert login.status_code == 200, login.text
    assert login.json()["user"]["email"] == "admin@makekal.id"
    assert "access_token" in s.cookies or login.json().get("token")
    assert s.get(f"{BASE_URL}/api/auth/me", timeout=20).status_code == 200

    local_id = f"TEST-{uuid.uuid4().hex}"
    purchase = s.post(f"{BASE_URL}/api/purchases", json={"local_id": local_id, "farmer_name": "TEST Farmer", "commodity_type": "TBS", "field_weight_kg": 100, "price_per_kg": 2450}, timeout=20)
    assert purchase.status_code == 200, purchase.text
    assert purchase.json()["total_cost"] == 245000
    items = s.get(f"{BASE_URL}/api/purchases", timeout=20).json()
    assert any(x["local_id"] == local_id for x in items)

def test_trip_calculation_and_anomaly():
    s = requests.Session()
    token = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@makekal.id", "password": "SawitMakekal2026!"}, timeout=20).json()["token"]
    s.headers["Authorization"] = f"Bearer {token}"
    trip = s.post(f"{BASE_URL}/api/trips", json={"local_id": f"TEST-TRIP-{uuid.uuid4().hex}", "dispatched_weight_kg": 1000, "loading_weight_kg": 900, "grade_a": {"weight_kg": 882, "price_per_kg": 2650}, "grade_b_returned_kg": 18}, timeout=20)
    assert trip.status_code == 200, trip.text
    data = trip.json()
    assert data["deduction_2pct_kg"] == 18
    assert data["billable_weight_kg"] == 882
    assert data["is_anomaly"] is True

def test_demo_dashboard_and_sync():
    s = requests.Session()
    seed = s.post(f"{BASE_URL}/api/seed-demo", timeout=30)
    assert seed.status_code == 200, seed.text
    stats = s.get(f"{BASE_URL}/api/dashboard/stats", timeout=20)
    assert stats.status_code == 200
    data = stats.json()
    assert data["financial_summary"]["anomaly_trips_count"] >= 1
    assert data["financial_summary"]["pending_receivables_count"] >= 1
    sync = s.post(f"{BASE_URL}/api/sync", json={"purchases": [], "trips": [], "expenses": []}, timeout=20)
    assert sync.status_code == 200 and sync.json()["status"] == "success"