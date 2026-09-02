"""Backend regression tests - BUB Makekal Hulu palm oil trading API (iteration 3).

Covers: auth (no brute-force lockout), dual-commodity trips, backdated entries,
edit/delete CRUD for purchases/trips/expenses, stock pool WAC, dashboard, settings.
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

SUFFIX = uuid.uuid4().hex[:6].upper()


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
    email = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?Email(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    pwd = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?Password(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    if not email or not pwd:
        pytest.skip("No credentials found")
    return {"email": email.group(1), "password": pwd.group(1)}


@pytest.fixture(scope="session")
def auth_token(api_client, test_credentials):
    r = api_client.post(f"{API}/auth/login", json=test_credentials)
    if r.status_code != 200:
        pytest.fail(f"Login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("token")
    if not tok:
        pytest.fail("No token in login response")
    return tok


@pytest.fixture(scope="session")
def authed(api_client, auth_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {auth_token}"})
    return s


# ----------------- AUTH: NO BRUTE FORCE LOCKOUT ----------------- #
class TestAuthNoLockout:
    def test_ten_wrong_passwords_all_401(self, api_client, test_credentials):
        codes = []
        for i in range(10):
            r = api_client.post(f"{API}/auth/login", json={
                "email": test_credentials["email"], "password": f"WrongPass{i}!"})
            codes.append(r.status_code)
        assert all(c == 401 for c in codes), f"Expected all 401, got {codes}"

    def test_correct_login_after_failures(self, api_client, test_credentials):
        r = api_client.post(f"{API}/auth/login", json=test_credentials)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert isinstance(data["token"], str) and len(data["token"]) > 10
        assert data["user"]["email"] == test_credentials["email"].lower()
        assert data["user"]["role"] in ("admin", "pengelola")
        # httpOnly cookie set
        cookie_hdr = r.headers.get("set-cookie", "")
        assert "access_token" in cookie_hdr and "HttpOnly" in cookie_hdr, cookie_hdr

    def test_auth_me_with_token(self, authed, test_credentials):
        r = authed.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == test_credentials["email"].lower()

    def test_auth_me_unauthenticated(self, api_client):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_cors_allows_credentials(self, test_credentials):
        # NOTE: OPTIONS preflight is answered by the edge proxy (returns "*"),
        # so credentialed CORS is verified on the actual request response.
        r = requests.post(f"{API}/auth/login", json=test_credentials,
                          headers={"Origin": BASE_URL})
        assert r.status_code == 200, r.status_code
        assert r.headers.get("access-control-allow-credentials") == "true", dict(r.headers)
        assert r.headers.get("access-control-allow-origin") in ("*", BASE_URL)


# ----------------- APP SETTINGS ----------------- #
class TestSettings:
    def test_default_unloading_rates(self, api_client):
        r = api_client.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        assert d["default_unloading_rate_tbs"] == 40000
        assert d["default_unloading_rate_berondol"] == 60000
        assert "_id" not in d


# ----------------- DUAL COMMODITY TRIP ----------------- #
class TestDualCommodityTrip:
    LOCAL_ID = f"TRIP-DUAL-{SUFFIX}"

    @pytest.fixture(scope="class")
    def dual_trip(self, api_client):
        payload = {
            "local_id": self.LOCAL_ID,
            "tbs_dispatched_kg": 1200, "tbs_loading_kg": 1180,
            "berondol_dispatched_kg": 400, "berondol_loading_kg": 395,
            "grade_a": {"weight_kg": 1100, "price_per_kg": 2700},
            "berondol_sold": {"weight_kg": 387, "price_per_kg": 2950},
            "transport_rate_per_ton": 70000,
            "unloading_rate_tbs_per_ton": 40000,
            "unloading_rate_berondol_per_ton": 60000,
            "tips": 15000, "payment_status": "COD",
        }
        r = api_client.post(f"{API}/trips", json=payload)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        yield r.json()
        api_client.delete(f"{API}/trips/{self.LOCAL_ID}")

    def test_commodity_type_dual(self, dual_trip):
        assert dual_trip["commodity_type"] == "DUAL"

    def test_total_revenue(self, dual_trip):
        assert dual_trip["total_revenue"] == pytest.approx(4111650, abs=0.5)

    def test_transport_cost(self, dual_trip):
        assert dual_trip["transport_cost"] == pytest.approx(112000, abs=0.5)

    def test_unloading_cost(self, dual_trip):
        assert dual_trip["unloading_cost"] == pytest.approx(70900, abs=0.5)

    def test_weights_and_deductions(self, dual_trip):
        assert dual_trip["dispatched_weight_kg"] == pytest.approx(1600)
        assert dual_trip["loading_weight_kg"] == pytest.approx(1575)
        assert dual_trip["weight_loss_kg"] == pytest.approx(25)
        assert dual_trip["weight_loss_pct"] == pytest.approx(1.56, abs=0.02)
        assert dual_trip["deduction_2pct_kg"] == pytest.approx(31.5, abs=0.05)
        assert dual_trip["billable_weight_kg"] == pytest.approx(1543.5, abs=0.05)

    def test_net_margin_consistency(self, dual_trip):
        expected_logistics = 112000 + 70900 + 15000
        assert dual_trip["total_logistic_expenses"] == pytest.approx(expected_logistics, abs=0.5)
        expected = dual_trip["total_revenue"] - dual_trip["cogs_allocated"] - dual_trip["total_logistic_expenses"]
        assert dual_trip["net_margin"] == pytest.approx(expected, abs=1)

    def test_cogs_uses_wac(self, dual_trip):
        expected_cogs = 1200 * dual_trip["wac_tbs_applied"] + 400 * dual_trip["wac_berondol_applied"]
        assert dual_trip["cogs_allocated"] == pytest.approx(expected_cogs, abs=1)

    def test_persisted_in_list(self, api_client, dual_trip):
        r = api_client.get(f"{API}/trips")
        assert r.status_code == 200
        found = [t for t in r.json() if t["local_id"] == self.LOCAL_ID]
        assert len(found) == 1
        assert "_id" not in found[0]


# ----------------- BACKDATED ENTRIES ----------------- #
class TestBackdatedEntries:
    def test_backdated_purchase(self, api_client):
        lid = f"PUR-BACK-{SUFFIX}"
        ts = "2025-11-15T10:00:00Z"
        r = api_client.post(f"{API}/purchases", json={
            "local_id": lid, "farmer_name": "TEST_Backdate Farmer",
            "commodity_type": "TBS", "field_weight_kg": 500, "price_per_kg": 2450,
            "timestamp": ts})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["timestamp"] == ts
        got = [p for p in api_client.get(f"{API}/purchases").json() if p["local_id"] == lid]
        assert got and got[0]["timestamp"] == ts
        api_client.delete(f"{API}/purchases/{lid}")

    def test_backdated_trip(self, api_client):
        lid = f"TRIP-BACK-{SUFFIX}"
        td = "2025-10-20T14:30:00Z"
        r = api_client.post(f"{API}/trips", json={
            "local_id": lid, "trip_date": td, "commodity_type": "TBS",
            "dispatched_weight_kg": 500, "loading_weight_kg": 490,
            "grade_a": {"weight_kg": 480, "price_per_kg": 2600}})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["trip_date"] == td
        api_client.delete(f"{API}/trips/{lid}")

    def test_backdated_expense(self, api_client):
        lid = f"EXP-BACK-{SUFFIX}"
        ts = "2025-12-01T09:00:00Z"
        r = api_client.post(f"{API}/expenses", json={
            "local_id": lid, "category": "Makan Pekerja", "amount": 50000,
            "description": "TEST_backdated", "worker_count": 2, "timestamp": ts})
        assert r.status_code == 200, r.text[:300]
        assert r.json()["timestamp"] == ts
        got = [e for e in api_client.get(f"{API}/expenses").json() if e["local_id"] == lid]
        assert got and got[0]["timestamp"] == ts
        api_client.delete(f"{API}/expenses/{lid}")


# ----------------- EDIT (PUT) ----------------- #
class TestEditPurchase:
    def test_edit_purchase_updates_values(self, api_client):
        lid = f"PUR-EDIT-{SUFFIX}"
        c = api_client.post(f"{API}/purchases", json={
            "local_id": lid, "farmer_name": "TEST_Edit Farmer", "commodity_type": "TBS",
            "field_weight_kg": 400, "price_per_kg": 2400})
        assert c.status_code == 200, c.text[:300]
        assert c.json()["total_cost"] == pytest.approx(960000)

        u = api_client.put(f"{API}/purchases/{lid}", json={
            "local_id": lid, "farmer_name": "TEST_Edit Farmer", "commodity_type": "TBS",
            "field_weight_kg": 600, "price_per_kg": 2500})
        assert u.status_code == 200, u.text[:300]

        got = [p for p in api_client.get(f"{API}/purchases").json() if p["local_id"] == lid]
        assert len(got) == 1, "Edit created duplicate rows"
        assert got[0]["field_weight_kg"] == 600
        assert got[0]["total_cost"] == pytest.approx(1500000)
        api_client.delete(f"{API}/purchases/{lid}")

    def test_edit_nonexistent_purchase_404(self, api_client):
        r = api_client.put(f"{API}/purchases/PUR-DOES-NOT-EXIST-{SUFFIX}", json={
            "farmer_name": "TEST_x", "field_weight_kg": 1, "price_per_kg": 1})
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"


class TestEditTrip:
    def test_edit_trip_upserts_not_duplicates(self, api_client):
        lid = f"TRIP-EDIT-{SUFFIX}"
        base = {
            "local_id": lid, "commodity_type": "TBS",
            "tbs_dispatched_kg": 1000, "tbs_loading_kg": 980,
            "grade_a": {"weight_kg": 950, "price_per_kg": 2600},
            "transport_rate_per_ton": 70000, "tips": 10000,
        }
        c = api_client.post(f"{API}/trips", json=base)
        assert c.status_code == 200, c.text[:300]
        assert c.json()["total_revenue"] == pytest.approx(2470000)

        edited = dict(base, tbs_dispatched_kg=1500, tbs_loading_kg=1480,
                      grade_a={"weight_kg": 1400, "price_per_kg": 2700}, tips=20000)
        u = api_client.put(f"{API}/trips/{lid}", json=edited)
        assert u.status_code == 200, u.text[:300]

        rows = [t for t in api_client.get(f"{API}/trips").json() if t["local_id"] == lid]
        assert len(rows) == 1, f"Edit produced {len(rows)} rows (duplicate)"
        assert rows[0]["total_revenue"] == pytest.approx(3780000)
        assert rows[0]["tbs_dispatched_kg"] == 1500
        assert rows[0]["tips"] == 20000
        api_client.delete(f"{API}/trips/{lid}")

    def test_edit_trip_without_local_id_in_body(self, api_client):
        """PUT should target the path id even if body omits local_id."""
        lid = f"TRIP-EDITNL-{SUFFIX}"
        c = api_client.post(f"{API}/trips", json={
            "local_id": lid, "commodity_type": "TBS",
            "tbs_dispatched_kg": 800, "tbs_loading_kg": 790,
            "grade_a": {"weight_kg": 780, "price_per_kg": 2500}})
        assert c.status_code == 200
        before = len(api_client.get(f"{API}/trips").json())
        u = api_client.put(f"{API}/trips/{lid}", json={
            "commodity_type": "TBS", "tbs_dispatched_kg": 900, "tbs_loading_kg": 890,
            "grade_a": {"weight_kg": 880, "price_per_kg": 2500}})
        assert u.status_code == 200, u.text[:300]
        rows = api_client.get(f"{API}/trips").json()
        target = [t for t in rows if t["local_id"] == lid]
        try:
            assert len(rows) == before, "PUT without body local_id created an extra trip document"
            assert target and target[0]["tbs_dispatched_kg"] == 900, "PUT did not update the targeted trip"
        finally:
            api_client.delete(f"{API}/trips/{lid}")
            for t in rows:
                if t["local_id"] not in (lid,) and t["local_id"].startswith("TRIP-") and t.get("tbs_dispatched_kg") == 900 and t["local_id"] != lid:
                    api_client.delete(f"{API}/trips/{t['local_id']}")


# ----------------- DELETE ----------------- #
class TestDelete:
    def test_delete_purchase(self, api_client):
        lid = f"PUR-DEL-{SUFFIX}"
        api_client.post(f"{API}/purchases", json={
            "local_id": lid, "farmer_name": "TEST_Del", "commodity_type": "TBS",
            "field_weight_kg": 100, "price_per_kg": 2000})
        r = api_client.delete(f"{API}/purchases/{lid}")
        assert r.status_code == 200, r.text[:200]
        assert not [p for p in api_client.get(f"{API}/purchases").json() if p["local_id"] == lid]

    def test_delete_trip(self, api_client):
        lid = f"TRIP-DEL-{SUFFIX}"
        api_client.post(f"{API}/trips", json={
            "local_id": lid, "commodity_type": "TBS",
            "tbs_dispatched_kg": 300, "tbs_loading_kg": 295,
            "grade_a": {"weight_kg": 290, "price_per_kg": 2500}})
        r = api_client.delete(f"{API}/trips/{lid}")
        assert r.status_code == 200
        assert not [t for t in api_client.get(f"{API}/trips").json() if t["local_id"] == lid]

    def test_delete_expense(self, api_client):
        lid = f"EXP-DEL-{SUFFIX}"
        api_client.post(f"{API}/expenses", json={
            "local_id": lid, "category": "Lain-lain", "amount": 10000, "description": "TEST_del"})
        r = api_client.delete(f"{API}/expenses/{lid}")
        assert r.status_code == 200
        assert not [e for e in api_client.get(f"{API}/expenses").json() if e["local_id"] == lid]

    def test_delete_nonexistent_returns_ok_or_404(self, api_client):
        r = api_client.delete(f"{API}/purchases/PUR-NOPE-{SUFFIX}")
        assert r.status_code in (200, 404), r.status_code


# ----------------- STOCK POOL WAC ----------------- #
class TestStockPoolWAC:
    def test_wac_and_pending_computation(self, api_client):
        base = api_client.get(f"{API}/stock-pool")
        assert base.status_code == 200
        b = base.json()

        p1 = f"PUR-WAC1-{SUFFIX}"
        p2 = f"PUR-WAC2-{SUFFIX}"
        trip = f"TRIP-WAC-{SUFFIX}"
        try:
            api_client.post(f"{API}/purchases", json={
                "local_id": p1, "farmer_name": "TEST_WAC", "commodity_type": "TBS",
                "field_weight_kg": 1000, "price_per_kg": 2000})
            api_client.post(f"{API}/purchases", json={
                "local_id": p2, "farmer_name": "TEST_WAC", "commodity_type": "BERONDOL",
                "field_weight_kg": 500, "price_per_kg": 3000})

            after = api_client.get(f"{API}/stock-pool").json()

            exp_tbs_kg = b["total_tbs_bought_kg"] + 1000
            exp_brd_kg = b["total_berondol_bought_kg"] + 500
            assert after["total_tbs_bought_kg"] == pytest.approx(exp_tbs_kg, abs=0.5)
            assert after["total_berondol_bought_kg"] == pytest.approx(exp_brd_kg, abs=0.5)

            # weighted-average cost must move toward newly added prices
            assert after["wac_tbs"] > 0 and after["wac_berondol"] > 0
            assert after["total_pending_kg"] == pytest.approx(
                after["pending_tbs_kg"] + after["pending_berondol_kg"], abs=0.5)
            pending_before = after["total_pending_kg"]

            # dual dispatch must reduce pending for both commodities
            api_client.post(f"{API}/trips", json={
                "local_id": trip, "tbs_dispatched_kg": 400, "tbs_loading_kg": 395,
                "berondol_dispatched_kg": 200, "berondol_loading_kg": 198,
                "grade_a": {"weight_kg": 380, "price_per_kg": 2700},
                "berondol_sold": {"weight_kg": 190, "price_per_kg": 3100}})
            final = api_client.get(f"{API}/stock-pool").json()
            assert final["total_pending_kg"] == pytest.approx(pending_before - 600, abs=1), \
                f"pending did not drop by 600: {pending_before} -> {final['total_pending_kg']}"
            assert final["target_kg"] > 0
            assert 0 <= final["target_progress_pct"] <= 100
        finally:
            api_client.delete(f"{API}/trips/{trip}")
            api_client.delete(f"{API}/purchases/{p1}")
            api_client.delete(f"{API}/purchases/{p2}")


# ----------------- DASHBOARD ----------------- #
class TestDashboard:
    def test_stats_structure(self, authed):
        r = authed.get(f"{API}/dashboard/stats")
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for key in ["financial_summary", "stock_pool", "anomaly_trips", "pending_receivables",
                    "recent_purchases", "recent_trips", "recent_expenses"]:
            assert key in d, f"missing {key}"
        fs = d["financial_summary"]
        for key in ["total_revenue", "total_cogs", "total_logistics", "total_net_margin",
                    "coop_net_profit", "total_purchase_cost"]:
            assert key in fs, f"missing financial_summary.{key}"
        assert isinstance(d["recent_trips"], list)
        for coll in ["recent_purchases", "recent_trips", "recent_expenses"]:
            for item in d[coll]:
                assert "_id" not in item, f"_id leaked in {coll}"


# ----------------- MASTER DATA & SYNC ----------------- #
class TestFarmersAndSync:
    def test_list_farmers(self, api_client):
        r = api_client.get(f"{API}/farmers")
        assert r.status_code == 200
        farmers = r.json()
        assert isinstance(farmers, list) and len(farmers) > 0
        assert "_id" not in farmers[0] and "id" in farmers[0]

    def test_create_farmer_idempotent(self, api_client):
        name = f"TEST_Farmer {SUFFIX}"
        r1 = api_client.post(f"{API}/farmers", json={"name": name})
        assert r1.status_code == 200
        r2 = api_client.post(f"{API}/farmers", json={"name": name})
        assert r2.status_code == 200
        assert r2.json()["id"] == r1.json()["id"], "Duplicate farmer created"

    def test_batch_sync(self, api_client):
        lid = f"PUR-SYNC-{SUFFIX}"
        elid = f"EXP-SYNC-{SUFFIX}"
        r = api_client.post(f"{API}/sync", json={
            "purchases": [{"local_id": lid, "farmer_name": "TEST_Sync", "commodity_type": "TBS",
                           "field_weight_kg": 200, "price_per_kg": 2400}],
            "trips": [],
            "expenses": [{"local_id": elid, "category": "Lain-lain", "amount": 5000,
                          "description": "TEST_sync"}]})
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["synced_counts"]["purchases"] == 1
        assert d["synced_counts"]["expenses"] == 1
        assert "stock_pool" in d
        api_client.delete(f"{API}/purchases/{lid}")
        api_client.delete(f"{API}/expenses/{elid}")


# ----------------- VALIDATION ----------------- #
class TestValidation:
    def test_purchase_missing_required_fields_422(self, api_client):
        r = api_client.post(f"{API}/purchases", json={"farmer_name": "TEST_x"})
        assert r.status_code == 422, r.status_code

    def test_expense_missing_amount_422(self, api_client):
        r = api_client.post(f"{API}/expenses", json={"category": "Lain-lain"})
        assert r.status_code == 422, r.status_code

    def test_negative_weight_purchase(self, api_client):
        lid = f"PUR-NEG-{SUFFIX}"
        r = api_client.post(f"{API}/purchases", json={
            "local_id": lid, "farmer_name": "TEST_Neg", "commodity_type": "TBS",
            "field_weight_kg": -100, "price_per_kg": 2400})
        api_client.delete(f"{API}/purchases/{lid}")
        assert r.status_code in (400, 422), f"Negative weight accepted with {r.status_code}"
