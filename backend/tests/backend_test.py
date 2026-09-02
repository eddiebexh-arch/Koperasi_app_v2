"""
BUB Makekal Hulu - Palm Oil Trading System :: Backend API regression tests (iteration 3)
Focus: no brute-force lockout, stock pool, backdated entries, DUAL commodity trips,
editable unloading rates, edit/delete CRUD, batch sync, dashboard stats.
"""
import os
import re
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def test_credentials():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("Missing /app/memory/test_credentials.md")
    content = p.read_text(encoding="utf-8")
    em = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    if not em or not pw:
        pytest.skip("No credentials found")
    return {"email": em.group(1), "password": pw.group(1)}


@pytest.fixture(scope="session")
def auth_token(api_client, test_credentials):
    r = api_client.post(f"{API}/auth/login", json=test_credentials)
    if r.status_code != 200:
        pytest.fail(f"Login failed {r.status_code}: {r.text[:300]}")
    token = r.json().get("token")
    if not token:
        pytest.fail("No token in login response")
    return token


@pytest.fixture(scope="session")
def created(api_client):
    """Track created resources for teardown."""
    tracker = {"purchases": [], "trips": [], "expenses": []}
    yield tracker
    for lid in tracker["purchases"]:
        api_client.delete(f"{API}/purchases/{lid}")
    for lid in tracker["trips"]:
        api_client.delete(f"{API}/trips/{lid}")
    for lid in tracker["expenses"]:
        api_client.delete(f"{API}/expenses/{lid}")


def new_id(prefix):
    return f"{prefix}-TEST{uuid.uuid4().hex[:8].upper()}"


# ---------- AUTH ----------
class TestAuth:
    def test_login_success(self, api_client, test_credentials):
        r = api_client.post(f"{API}/auth/login", json=test_credentials)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("token"), str) and len(d["token"]) > 20
        assert d["user"]["email"] == test_credentials["email"]
        assert d["user"]["role"] in ("admin", "pengelola")
        # httpOnly cookie set
        assert "access_token" in r.cookies, f"cookies={r.cookies.get_dict()}"
        assert "httponly" in r.headers.get("set-cookie", "").lower()

    def test_no_bruteforce_lockout(self, test_credentials):
        s = requests.Session()
        codes = []
        for _ in range(7):
            r = s.post(f"{API}/auth/login", json={"email": test_credentials["email"], "password": "WrongPass123!"})
            codes.append(r.status_code)
        assert all(c == 401 for c in codes), f"Expected all 401, got {codes}"
        assert 429 not in codes
        # correct password still works afterwards
        r = s.post(f"{API}/auth/login", json=test_credentials)
        assert r.status_code == 200, f"Locked out after failures: {r.status_code} {r.text[:200]}"

    def test_me_requires_auth(self, auth_token):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401
        r2 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {auth_token}"})
        assert r2.status_code == 200
        assert "email" in r2.json()

    def test_bcrypt_hash_format(self):
        # verify seeded admin hash format directly in DB
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import dotenv_values as dv
        env = dv("/app/backend/.env")
        mongo_url = os.environ.get("MONGO_URL") or env.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME") or env.get("DB_NAME")
        if not mongo_url or not db_name:
            pytest.skip("MONGO_URL/DB_NAME unavailable")

        async def _check():
            c = AsyncIOMotorClient(mongo_url)
            u = await c[db_name].users.find_one({"email": "admin@makekal.id"})
            c.close()
            return u

        user = asyncio.get_event_loop().run_until_complete(_check()) if False else asyncio.run(_check())
        assert user is not None, "Seeded admin not found in DB"
        assert user["password_hash"].startswith("$2b$"), user["password_hash"][:10]


# ---------- STOCK POOL ----------
class TestStockPool:
    def test_stock_pool_fields(self, api_client):
        r = api_client.get(f"{API}/stock-pool")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["pending_tbs_kg", "pending_berondol_kg", "wac_tbs", "wac_berondol",
                  "total_pending_kg", "total_pending_value", "target_progress_pct"]:
            assert k in d, f"missing {k}"
            assert isinstance(d[k], (int, float))
        assert "_id" not in d


# ---------- PURCHASES ----------
class TestPurchases:
    def test_create_backdated_purchase_and_persist(self, api_client, created):
        lid = new_id("PUR")
        payload = {
            "local_id": lid,
            "farmer_name": "TEST_Petani Backdate",
            "commodity_type": "TBS",
            "field_weight_kg": 500,
            "price_per_kg": 2400,
            "timestamp": "2025-10-15T10:00:00Z",
        }
        r = api_client.post(f"{API}/purchases", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        created["purchases"].append(lid)
        assert d["local_id"] == lid
        assert d["timestamp"] == "2025-10-15T10:00:00Z"
        assert d["total_cost"] == 1200000.0
        assert "_id" not in d

        lst = api_client.get(f"{API}/purchases?limit=200").json()
        match = [p for p in lst if p["local_id"] == lid]
        assert match, "backdated purchase not returned by GET /purchases"
        assert match[0]["timestamp"] == "2025-10-15T10:00:00Z"
        assert match[0]["field_weight_kg"] == 500

    def test_update_purchase_recomputes_total(self, api_client, created):
        lid = new_id("PUR")
        api_client.post(f"{API}/purchases", json={
            "local_id": lid, "farmer_name": "TEST_Edit Petani",
            "commodity_type": "TBS", "field_weight_kg": 400, "price_per_kg": 2000,
            "timestamp": "2025-11-01T08:00:00Z"})
        created["purchases"].append(lid)

        r = api_client.put(f"{API}/purchases/{lid}", json={
            "local_id": lid, "farmer_name": "TEST_Edit Petani",
            "commodity_type": "TBS", "field_weight_kg": 400, "price_per_kg": 2500})
        assert r.status_code == 200, r.text

        lst = api_client.get(f"{API}/purchases?limit=200").json()
        rec = next(p for p in lst if p["local_id"] == lid)
        assert rec["price_per_kg"] == 2500
        assert rec["total_cost"] == 1000000.0

    def test_update_missing_purchase_404(self, api_client):
        r = api_client.put(f"{API}/purchases/PUR-DOESNOTEXIST", json={
            "farmer_name": "TEST_X", "field_weight_kg": 1, "price_per_kg": 1})
        assert r.status_code == 404, r.status_code

    def test_delete_purchase(self, api_client):
        lid = new_id("PUR")
        api_client.post(f"{API}/purchases", json={
            "local_id": lid, "farmer_name": "TEST_Delete Petani",
            "commodity_type": "BERONDOL", "field_weight_kg": 100, "price_per_kg": 2700})
        r = api_client.delete(f"{API}/purchases/{lid}")
        assert r.status_code == 200, r.text
        lst = api_client.get(f"{API}/purchases?limit=200").json()
        assert not [p for p in lst if p["local_id"] == lid], "purchase still present after delete"


# ---------- TRIPS: DUAL COMMODITY ----------
class TestTripsDual:
    def test_dual_commodity_trip(self, api_client, created):
        lid = new_id("TRIP")
        payload = {
            "local_id": lid,
            "commodity_type": "TBS",
            "tbs_dispatched_kg": 1000, "tbs_loading_kg": 980,
            "berondol_dispatched_kg": 300, "berondol_loading_kg": 295,
            "grade_a": {"weight_kg": 900, "price_per_kg": 2700},
            "berondol_sold": {"weight_kg": 290, "price_per_kg": 2900},
            "berondol_grade_b_sold": {"weight_kg": 50, "price_per_kg": 2400},
        }
        r = api_client.post(f"{API}/trips", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        created["trips"].append(lid)

        assert d["commodity_type"] == "DUAL", d["commodity_type"]
        assert d["grade_a"]["revenue"] == 2430000.0
        assert d["berondol_sold"]["revenue"] == 841000.0
        assert d["berondol_grade_b_sold"]["revenue"] == 120000.0
        expected_rev = 2430000.0 + 841000.0 + 120000.0
        assert d["total_revenue"] == expected_rev, d["total_revenue"]
        # unloading defaults 40k/ton TBS + 60k/ton Berondol on loading weights
        assert d["unloading_cost"] == round(0.980 * 40000 + 0.295 * 60000, 2), d["unloading_cost"]
        assert d["dispatched_weight_kg"] == 1300
        assert d["loading_weight_kg"] == 1275
        assert d["weight_loss_kg"] == 25
        assert d["tips"] == 0
        # margin identity
        assert round(d["net_margin"], 2) == round(
            d["total_revenue"] - d["cogs_allocated"] - d["total_logistic_expenses"], 2)
        assert "_id" not in d

    def test_custom_unloading_rates(self, api_client, created):
        lid = new_id("TRIP")
        r = api_client.post(f"{API}/trips", json={
            "local_id": lid,
            "tbs_dispatched_kg": 1000, "tbs_loading_kg": 980,
            "berondol_dispatched_kg": 300, "berondol_loading_kg": 295,
            "unloading_rate_tbs_per_ton": 50000,
            "unloading_rate_berondol_per_ton": 80000,
            "grade_a": {"weight_kg": 900, "price_per_kg": 2700},
        })
        assert r.status_code == 200, r.text
        d = r.json()
        created["trips"].append(lid)
        assert d["unloading_rate_tbs_per_ton"] == 50000
        assert d["unloading_rate_berondol_per_ton"] == 80000
        assert d["unloading_cost"] == round(0.980 * 50000 + 0.295 * 80000, 2), d["unloading_cost"]

    def test_backdated_trip(self, api_client, created):
        lid = new_id("TRIP")
        r = api_client.post(f"{API}/trips", json={
            "local_id": lid, "trip_date": "2025-11-01T09:00:00Z",
            "commodity_type": "TBS", "dispatched_weight_kg": 800, "loading_weight_kg": 790,
            "grade_a": {"weight_kg": 770, "price_per_kg": 2600},
        })
        assert r.status_code == 200, r.text
        d = r.json()
        created["trips"].append(lid)
        assert d["trip_date"] == "2025-11-01T09:00:00Z"
        assert d["tbs_dispatched_kg"] == 800, "single-commodity fallback failed"
        assert d["commodity_type"] == "TBS"
        trips = api_client.get(f"{API}/trips?limit=200").json()
        rec = next((t for t in trips if t["local_id"] == lid), None)
        assert rec is not None and rec["trip_date"] == "2025-11-01T09:00:00Z"

    def test_update_trip_recalculates(self, api_client, created):
        lid = new_id("TRIP")
        api_client.post(f"{API}/trips", json={
            "local_id": lid, "commodity_type": "TBS",
            "tbs_dispatched_kg": 1000, "tbs_loading_kg": 980,
            "grade_a": {"weight_kg": 900, "price_per_kg": 2500},
        })
        created["trips"].append(lid)
        before = api_client.get(f"{API}/trips?limit=200").json()
        count_before = len([t for t in before if t["local_id"] == lid])

        r = api_client.put(f"{API}/trips/{lid}", json={
            "local_id": lid, "commodity_type": "TBS",
            "tbs_dispatched_kg": 1000, "tbs_loading_kg": 980,
            "grade_a": {"weight_kg": 900, "price_per_kg": 2800},
        })
        assert r.status_code == 200, r.text
        body = r.json()
        trip = body.get("trip", body)
        assert trip["grade_a"]["price_per_kg"] == 2800
        assert trip["total_revenue"] == 2520000.0

        after = api_client.get(f"{API}/trips?limit=200").json()
        recs = [t for t in after if t["local_id"] == lid]
        assert len(recs) == count_before == 1, f"update duplicated records: {len(recs)}"
        assert recs[0]["total_revenue"] == 2520000.0

    def test_update_trip_without_local_id_should_not_create_duplicate(self, api_client, created):
        """PUT should target the path trip_id even if body omits local_id."""
        lid = new_id("TRIP")
        api_client.post(f"{API}/trips", json={
            "local_id": lid, "commodity_type": "TBS",
            "tbs_dispatched_kg": 500, "tbs_loading_kg": 495,
            "grade_a": {"weight_kg": 480, "price_per_kg": 2500},
        })
        created["trips"].append(lid)

        r = api_client.put(f"{API}/trips/{lid}", json={
            "commodity_type": "TBS",
            "tbs_dispatched_kg": 500, "tbs_loading_kg": 495,
            "grade_a": {"weight_kg": 480, "price_per_kg": 2600},
        })
        assert r.status_code == 200, r.text
        after = api_client.get(f"{API}/trips?limit=200").json()
        recs = [t for t in after if t["local_id"] == lid]
        assert len(recs) == 1, "target trip missing after PUT"
        assert recs[0]["grade_a"]["price_per_kg"] == 2600, "PUT did not update target trip"
        orphans = [t for t in after if t["local_id"] != lid
                   and t.get("tbs_dispatched_kg") == 500
                   and t.get("total_revenue") == 480 * 2600]
        assert not orphans, f"PUT created an extra trip record (orphan): {[o['local_id'] for o in orphans]}"

    def test_delete_trip_and_wac_recalc(self, api_client, created):
        # purchase to give TBS stock
        pur = new_id("PUR")
        api_client.post(f"{API}/purchases", json={
            "local_id": pur, "farmer_name": "TEST_WAC Petani",
            "commodity_type": "TBS", "field_weight_kg": 2000, "price_per_kg": 2500})
        created["purchases"].append(pur)

        pool_before = api_client.get(f"{API}/stock-pool").json()

        lid = new_id("TRIP")
        r = api_client.post(f"{API}/trips", json={
            "local_id": lid, "commodity_type": "TBS",
            "tbs_dispatched_kg": 1000, "tbs_loading_kg": 980,
            "grade_b_returned_kg": 100,
            "grade_a": {"weight_kg": 850, "price_per_kg": 2700},
        })
        assert r.status_code == 200, r.text
        pool_mid = api_client.get(f"{API}/stock-pool").json()
        assert pool_mid["total_grade_b_returned_kg"] >= 100

        dr = api_client.delete(f"{API}/trips/{lid}")
        assert dr.status_code == 200, dr.text
        trips = api_client.get(f"{API}/trips?limit=200").json()
        assert not [t for t in trips if t["local_id"] == lid]

        pool_after = api_client.get(f"{API}/stock-pool").json()
        assert pool_after["total_grade_b_returned_kg"] == pool_before["total_grade_b_returned_kg"], \
            "returned Grade B not reverted after trip delete"
        assert pool_after["pending_tbs_kg"] == pool_before["pending_tbs_kg"]
        assert pool_after["wac_berondol"] == pool_before["wac_berondol"]


# ---------- EXPENSES ----------
class TestExpenses:
    def test_create_backdated_expense_and_delete(self, api_client):
        lid = new_id("EXP")
        r = api_client.post(f"{API}/expenses", json={
            "local_id": lid, "category": "Makan Pekerja", "amount": 90000,
            "description": "TEST_Makan buruh", "worker_count": 3,
            "timestamp": "2025-12-05T04:00:00Z"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["timestamp"] == "2025-12-05T04:00:00Z"
        assert d["amount"] == 90000.0
        assert d["worker_count"] == 3

        dr = api_client.delete(f"{API}/expenses/{lid}")
        assert dr.status_code == 200, dr.text
        lst = api_client.get(f"{API}/expenses?limit=200").json()
        assert not [e for e in lst if e["local_id"] == lid]


# ---------- BATCH SYNC ----------
class TestBatchSync:
    def test_sync_batch_idempotent(self, api_client, created):
        p_id, t_id, e_id = new_id("PUR"), new_id("TRIP"), new_id("EXP")
        payload = {
            "purchases": [{"local_id": p_id, "farmer_name": "TEST_Sync Petani",
                           "commodity_type": "TBS", "field_weight_kg": 300,
                           "price_per_kg": 2450, "timestamp": "2025-12-01T02:00:00Z"}],
            "trips": [{"local_id": t_id, "commodity_type": "TBS",
                       "trip_date": "2025-12-01T06:00:00Z",
                       "tbs_dispatched_kg": 300, "tbs_loading_kg": 295,
                       "grade_a": {"weight_kg": 289, "price_per_kg": 2650}}],
            "expenses": [{"local_id": e_id, "category": "Lain-lain", "amount": 25000,
                          "description": "TEST_Sync expense",
                          "timestamp": "2025-12-01T07:00:00Z"}],
        }
        r1 = api_client.post(f"{API}/sync", json=payload)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["status"] == "success"
        assert d1["synced_counts"]["total"] == 3, d1["synced_counts"]
        assert "stock_pool" in d1

        r2 = api_client.post(f"{API}/sync", json=payload)
        assert r2.status_code == 200
        assert r2.json()["synced_counts"]["total"] == 3

        created["purchases"].append(p_id)
        created["trips"].append(t_id)
        created["expenses"].append(e_id)

        purchases = api_client.get(f"{API}/purchases?limit=200").json()
        assert len([p for p in purchases if p["local_id"] == p_id]) == 1, "sync duplicated purchase"
        trips = api_client.get(f"{API}/trips?limit=200").json()
        assert len([t for t in trips if t["local_id"] == t_id]) == 1, "sync duplicated trip"
        expenses = api_client.get(f"{API}/expenses?limit=200").json()
        assert len([e for e in expenses if e["local_id"] == e_id]) == 1, "sync duplicated expense"


# ---------- DASHBOARD ----------
class TestDashboard:
    def test_dashboard_requires_auth(self):
        r = requests.get(f"{API}/dashboard/stats")
        assert r.status_code == 401, f"dashboard accessible without JWT: {r.status_code}"

    def test_dashboard_stats_with_cookie_auth(self, test_credentials):
        s = requests.Session()
        lr = s.post(f"{API}/auth/login", json=test_credentials)
        assert lr.status_code == 200, lr.text
        r = s.get(f"{API}/dashboard/stats")  # no Authorization header, cookie only
        assert r.status_code == 200, f"cookie auth rejected: {r.status_code} {r.text[:200]}"
        assert "stock_pool" in r.json()

    def test_dashboard_stats_structure(self, auth_token):
        r = requests.get(f"{API}/dashboard/stats", headers={"Authorization": f"Bearer {auth_token}"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "stock_pool" in d and "financial_summary" in d and "anomaly_trips" in d
        fs = d["financial_summary"]
        for k in ["total_revenue", "total_cogs", "total_net_margin",
                  "coop_net_profit", "total_operational_expenses"]:
            assert k in fs
        assert isinstance(d["anomaly_trips"], list)
        for t in d["anomaly_trips"]:
            assert "_id" not in t


# ---------- ITERATION 4: 404 SEMANTICS ON PUT/DELETE ----------
class TestNotFoundSemantics:
    def test_put_unknown_trip_returns_404(self, api_client):
        r = api_client.put(f"{API}/trips/TRIP-DOESNOTEXIST-XYZ", json={
            "commodity_type": "TBS",
            "tbs_dispatched_kg": 100, "tbs_loading_kg": 99,
            "grade_a": {"weight_kg": 90, "price_per_kg": 2500},
        })
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:200]}"
        # ensure no orphan trip was created
        trips = api_client.get(f"{API}/trips?limit=200").json()
        assert not [t for t in trips if t.get("local_id") == "TRIP-DOESNOTEXIST-XYZ"]

    def test_delete_unknown_purchase_returns_404(self, api_client):
        r = api_client.delete(f"{API}/purchases/PUR-NOPE-{uuid.uuid4().hex[:6]}")
        assert r.status_code == 404, f"{r.status_code}: {r.text[:200]}"

    def test_delete_unknown_trip_returns_404(self, api_client):
        r = api_client.delete(f"{API}/trips/TRIP-NOPE-{uuid.uuid4().hex[:6]}")
        assert r.status_code == 404, f"{r.status_code}: {r.text[:200]}"

    def test_delete_unknown_expense_returns_404(self, api_client):
        r = api_client.delete(f"{API}/expenses/EXP-NOPE-{uuid.uuid4().hex[:6]}")
        assert r.status_code == 404, f"{r.status_code}: {r.text[:200]}"

    def test_put_trip_with_matching_local_id_updates_in_place(self, api_client, created):
        lid = new_id("TRIP")
        api_client.post(f"{API}/trips", json={
            "local_id": lid, "commodity_type": "TBS",
            "tbs_dispatched_kg": 700, "tbs_loading_kg": 690,
            "grade_a": {"weight_kg": 680, "price_per_kg": 2400},
        })
        created["trips"].append(lid)
        r = api_client.put(f"{API}/trips/{lid}", json={
            "local_id": lid, "commodity_type": "TBS",
            "tbs_dispatched_kg": 700, "tbs_loading_kg": 690,
            "grade_a": {"weight_kg": 680, "price_per_kg": 2900},
        })
        assert r.status_code == 200, r.text
        after = api_client.get(f"{API}/trips?limit=200").json()
        recs = [t for t in after if t["local_id"] == lid]
        assert len(recs) == 1, f"duplicate trips: {len(recs)}"
        assert recs[0]["grade_a"]["price_per_kg"] == 2900
        assert recs[0]["total_revenue"] == 680 * 2900
        # no orphan trip carrying the updated payload under a different id
        orphans = [t for t in after if t["local_id"] != lid
                   and t.get("total_revenue") == 680 * 2900
                   and t.get("tbs_dispatched_kg") == 700]
        assert not orphans, f"PUT created orphan trip(s): {[o['local_id'] for o in orphans]}"


# ---------- ITERATION 4: CORS / PLAYBOOK ----------
class TestCorsCredentials:
    def test_cors_allows_credentials_with_explicit_origin(self):
        origin = BASE_URL
        r = requests.options(f"{API}/auth/login", headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        })
        assert r.status_code in (200, 204), r.status_code
        acao = r.headers.get("access-control-allow-origin")
        acac = r.headers.get("access-control-allow-credentials")
        # NOTE: the preview edge proxy rewrites allow-origin to "*"; the app itself
        # (verified directly on 0.0.0.0:8001) returns the explicit origin.
        assert acao in (origin, "*"), f"allow-origin={acao}"
        # The preview edge proxy answers preflights itself and does not always echo
        # allow-credentials; the authoritative check is the app-level test below.
        if acac is not None:
            assert acac == "true", f"allow-credentials={acac}"

    def test_app_level_cors_returns_explicit_origin(self):
        """Verify the FastAPI CORSMiddleware config itself (not the edge proxy)."""
        import subprocess
        origin = BASE_URL
        out = subprocess.run(
            ["curl", "-s", "-i", "-X", "OPTIONS", "http://localhost:8001/api/auth/login",
             "-H", f"Origin: {origin}", "-H", "Access-Control-Request-Method: POST"],
            capture_output=True, text=True, timeout=20).stdout.lower()
        assert f"access-control-allow-origin: {origin.lower()}" in out, out[:500]
        assert "access-control-allow-credentials: true" in out, out[:500]


# ---------- ITERATION 4: INPUT SAFETY (KNOWN OPEN BUG) ----------
class TestRegexSafety:
    def test_purchase_with_regex_special_char_farmer_name(self, api_client, created):
        lid = new_id("PUR")
        r = api_client.post(f"{API}/purchases", json={
            "local_id": lid, "farmer_name": "TEST_Pak (Budi",
            "commodity_type": "TBS", "field_weight_kg": 10, "price_per_kg": 100})
        if r.status_code == 200:
            created["purchases"].append(lid)
        assert r.status_code == 200, (
            f"unescaped farmer_name in Mongo $regex -> {r.status_code}: {r.text[:150]}")
