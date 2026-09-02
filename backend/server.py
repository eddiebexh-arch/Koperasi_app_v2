import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator
from typing_extensions import Annotated
import bcrypt
import jwt

# Logger setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("bub_makekal")

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "palm_ledger_db")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

JWT_SECRET = os.environ.get("JWT_SECRET", "bub_makekal_hulu_super_secret_jwt_key_2026_palm_oil_trading_system")
JWT_ALGORITHM = "HS256"

# Helper to serialize ObjectId
def convert_mongo_id(doc: dict) -> dict:
    if not doc:
        return doc
    doc_copy = dict(doc)
    if "_id" in doc_copy:
        doc_copy["id"] = str(doc_copy.pop("_id"))
    return doc_copy

# Password Hashing
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

# JWT Helpers
def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user_optional(request: Request) -> Optional[dict]:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"email": payload["email"]})
        if user:
            return convert_mongo_id(user)
    except Exception:
        pass
    return None

async def get_current_user(request: Request) -> dict:
    user = await get_current_user_optional(request)
    if not user:
        raise HTTPException(status_code=401, detail="Autentikasi diperlukan. Silakan login.")
    return user

# Pydantic Models
class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "pengelola"

class UserLogin(BaseModel):
    email: str
    password: str

class FarmerCreate(BaseModel):
    name: str
    village: Optional[str] = "Makekal Hulu"
    phone: Optional[str] = ""
    notes: Optional[str] = ""

class AppSettingsModel(BaseModel):
    default_transport_rate_per_ton: float = 70000.0  # Rp per ton (1000kg)
    transport_preset_options: List[float] = [70000.0, 100000.0]
    default_unloading_rate_tbs: float = 25.0  # Rp per kg
    default_unloading_rate_berondol: float = 30.0  # Rp per kg
    shrinkage_alert_pct: float = 5.0  # Susut > 5% ditandai merah
    last_price_tbs: float = 2450.0  # Rp per kg
    last_price_berondol: float = 2700.0  # Rp per kg
    minimum_pool_target_kg: float = 2000.0  # 2 Ton target progress

class PurchaseTransactionCreate(BaseModel):
    local_id: Optional[str] = None
    farmer_name: str
    commodity_type: str = "TBS"  # 'TBS' or 'BERONDOL'
    field_weight_kg: float
    price_per_kg: float
    total_cost: Optional[float] = None
    photo_url: Optional[str] = ""
    notes: Optional[str] = ""
    status: str = "PAID"
    timestamp: Optional[str] = None

class GradeSplit(BaseModel):
    weight_kg: float = 0.0
    price_per_kg: float = 0.0
    revenue: float = 0.0

class SalesTripCreate(BaseModel):
    local_id: Optional[str] = None
    trip_date: Optional[str] = None
    loading_name: str = "Loading RAM Makekal"
    nota_number: Optional[str] = ""
    commodity_type: str = "TBS"  # 'TBS' | 'BERONDOL' | 'MIXED'
    dispatched_weight_kg: float  # Berat saat berangkat dari lapangan (alokasi pool)
    loading_weight_kg: float  # Berat hasil timbang loading
    grade_a: Optional[GradeSplit] = None
    grade_b_sold: Optional[GradeSplit] = None
    grade_b_returned_kg: float = 0.0  # Retur bawa pulang untuk berondol
    transport_rate_per_ton: float = 70000.0
    transport_cost: Optional[float] = None
    unloading_rate_tbs: float = 25.0
    unloading_rate_berondol: float = 30.0
    unloading_cost: Optional[float] = None
    tips: float = 0.0
    payment_status: str = "COD"  # 'COD' or 'PENDING'
    due_date: Optional[str] = None
    cogs_allocated: Optional[float] = None
    notes: Optional[str] = ""

class OperationalExpenseCreate(BaseModel):
    local_id: Optional[str] = None
    category: str  # 'Makan Pekerja', 'BBM/Transport Lapangan', 'Perlengkapan/Alat', 'Dana Sosial', 'Lain-lain'
    amount: float
    description: str
    worker_count: Optional[int] = 0
    timestamp: Optional[str] = None

class BatchSyncPayload(BaseModel):
    purchases: List[PurchaseTransactionCreate] = []
    trips: List[SalesTripCreate] = []
    expenses: List[OperationalExpenseCreate] = []

# FastAPI App
app = FastAPI(title="BUB Makekal Hulu - Palm Oil Trading System")
api_router = APIRouter(prefix="/api")

# Startup event: Seed initial data
@app.on_event("startup")
async def startup_event():
    # 1. Check or Seed Settings
    settings = await db.app_settings.find_one({"setting_id": "default"})
    if not settings:
        default_settings = AppSettingsModel().model_dump()
        default_settings["setting_id"] = "default"
        default_settings["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.app_settings.insert_one(default_settings)
        logger.info("Initialized default app settings.")

    # 2. Seed Default Admin Account
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@makekal.id")
    admin_pass = os.environ.get("ADMIN_PASSWORD", "SawitMakekal2026!")
    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        hashed = hash_password(admin_pass)
        await db.users.insert_one({
            "name": "Pengelola BUB Makekal",
            "email": admin_email,
            "password_hash": hashed,
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Created default admin user: %s", admin_email)

    # 3. Seed Farmers if empty
    farmer_count = await db.farmers.count_documents({})
    if farmer_count == 0:
        sample_farmers = [
            {"name": "Pak Budi Makekal", "village": "Makekal Hulu", "phone": "081234567801", "notes": "Kelompok Tani 1", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Pak Tumenggung Marituha", "village": "Makekal Hulu", "phone": "081234567802", "notes": "Orang Rimba Makekal", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Pak Nyenong", "village": "Makekal Hulu", "phone": "081234567803", "notes": "Kebun Blok A", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Pak Ngotap", "village": "Makekal Hulu", "phone": "081234567804", "notes": "Kebun Blok B", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Bu Siti Aminah", "village": "Makekal Hilir", "phone": "081234567805", "notes": "Petani Swadaya", "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Pak Hasan Basri", "village": "Makekal Hulu", "phone": "081234567806", "notes": "Petani TBS & Berondol", "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await db.farmers.insert_many(sample_farmers)
        logger.info("Seeded initial farmers list.")

    # 4. Indexes
    await db.users.create_index("email", unique=True)
    await db.purchase_transactions.create_index("local_id")
    await db.sales_trips.create_index("local_id")
    await db.operational_expenses.create_index("local_id")


# ----------------- AUTH ROUTES ----------------- #

@api_router.get("/auth/check-init")
async def check_admin_init():
    user_count = await db.users.count_documents({})
    return {"initialized": user_count > 0, "user_count": user_count}

@api_router.post("/auth/setup-admin")
async def setup_initial_admin(user_data: UserCreate, response: Response):
    user_count = await db.users.count_documents({})
    if user_count > 0:
        # Check if already initialized, but allow if forced or valid
        existing = await db.users.find_one({"email": user_data.email.lower()})
        if existing:
            raise HTTPException(status_code=400, detail="Pengguna dengan email ini sudah terdaftar.")
    
    hashed = hash_password(user_data.password)
    user_doc = {
        "name": user_data.name,
        "email": user_data.email.lower(),
        "password_hash": hashed,
        "role": user_data.role or "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    token = create_access_token(user_id, user_data.email.lower(), user_doc["role"])
    
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=86400,
        path="/"
    )
    return {
        "message": "Akun pengelola berhasil dibuat.",
        "token": token,
        "user": {"id": user_id, "name": user_doc["name"], "email": user_doc["email"], "role": user_doc["role"]}
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin, response: Response):
    email = credentials.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email atau password salah.")
    
    user_id = str(user["_id"])
    token = create_access_token(user_id, email, user.get("role", "pengelola"))
    
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=86400,
        path="/"
    )
    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": user.get("name", "Pengelola"),
            "email": email,
            "role": user.get("role", "pengelola")
        }
    }

@api_router.get("/auth/me")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "name": current_user.get("name", "Pengelola"),
        "email": current_user.get("email"),
        "role": current_user.get("role", "pengelola")
    }

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    return {"message": "Berhasil logout"}


# ----------------- MASTER DATA & SETTINGS ----------------- #

@api_router.get("/settings")
async def get_settings():
    settings = await db.app_settings.find_one({"setting_id": "default"})
    if not settings:
        default_settings = AppSettingsModel().model_dump()
        default_settings["setting_id"] = "default"
        return default_settings
    return convert_mongo_id(settings)

@api_router.put("/settings")
async def update_settings(payload: AppSettingsModel, current_user: dict = Depends(get_current_user)):
    data = payload.model_dump()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.app_settings.update_one({"setting_id": "default"}, {"$set": data}, upsert=True)
    return {"message": "Pengaturan berhasil diperbarui", "settings": data}

@api_router.get("/farmers")
async def get_farmers():
    cursor = db.farmers.find().sort("name", 1)
    farmers = await cursor.to_list(1000)
    return [convert_mongo_id(f) for f in farmers]

@api_router.post("/farmers")
async def create_farmer(payload: FarmerCreate):
    name_clean = payload.name.strip()
    existing = await db.farmers.find_one({"name": {"$regex": f"^{name_clean}$", "$options": "i"}})
    if existing:
        return convert_mongo_id(existing)
    
    doc = {
        "name": name_clean,
        "village": payload.village or "Makekal Hulu",
        "phone": payload.phone or "",
        "notes": payload.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    res = await db.farmers.insert_one(doc)
    doc_res = convert_mongo_id(doc)
    doc_res["id"] = str(res.inserted_id)
    return doc_res


# ----------------- STOCK POOL & WAC CALCULATION ----------------- #

async def compute_virtual_stock_pool():
    # 1. Aggregate all purchases by commodity
    purchases = await db.purchase_transactions.find().to_list(10000)
    # 2. Aggregate all sales trips dispatched weight & returned grade B
    trips = await db.sales_trips.find().to_list(5000)

    # Total Purchased
    total_tbs_bought_kg = 0.0
    total_tbs_bought_cost = 0.0
    total_berondol_bought_kg = 0.0
    total_berondol_bought_cost = 0.0

    for p in purchases:
        ctype = p.get("commodity_type", "TBS").upper()
        w = float(p.get("field_weight_kg", 0.0))
        cost = float(p.get("total_cost", 0.0)) or (w * float(p.get("price_per_kg", 0.0)))
        if ctype == "BERONDOL":
            total_berondol_bought_kg += w
            total_berondol_bought_cost += cost
        else:
            total_tbs_bought_kg += w
            total_tbs_bought_cost += cost

    # Total Dispatched from Trips
    total_tbs_dispatched_kg = 0.0
    total_berondol_dispatched_kg = 0.0
    total_grade_b_returned_kg = 0.0

    for t in trips:
        ctype = t.get("commodity_type", "TBS").upper()
        disp_w = float(t.get("dispatched_weight_kg", 0.0))
        ret_b = float(t.get("grade_b_returned_kg", 0.0))

        total_grade_b_returned_kg += ret_b
        if ctype == "BERONDOL":
            total_berondol_dispatched_kg += disp_w
        elif ctype == "MIXED":
            # If mixed, split by grade weights if available or treat as TBS
            total_tbs_dispatched_kg += disp_w
        else:
            total_tbs_dispatched_kg += disp_w

    # Grade B bawa pulang returned into Berondol Pool
    # WAC TBS Calculation
    wac_tbs = (total_tbs_bought_cost / total_tbs_bought_kg) if total_tbs_bought_kg > 0 else 2450.0
    # Berondol pool gets extra weight from returned Grade B evaluated at TBS WAC
    berondol_effective_bought_kg = total_berondol_bought_kg + total_grade_b_returned_kg
    berondol_effective_bought_cost = total_berondol_bought_cost + (total_grade_b_returned_kg * wac_tbs)
    wac_berondol = (berondol_effective_bought_cost / berondol_effective_bought_kg) if berondol_effective_bought_kg > 0 else 2700.0

    # Net Pending in Pool
    pending_tbs_kg = max(0.0, total_tbs_bought_kg - total_tbs_dispatched_kg)
    pending_berondol_kg = max(0.0, berondol_effective_bought_kg - total_berondol_dispatched_kg)
    total_pending_kg = pending_tbs_kg + pending_berondol_kg

    total_pending_value = (pending_tbs_kg * wac_tbs) + (pending_berondol_kg * wac_berondol)

    settings = await db.app_settings.find_one({"setting_id": "default"}) or {}
    target_kg = float(settings.get("minimum_pool_target_kg", 2000.0))
    target_progress_pct = min(100.0, (total_pending_kg / target_kg * 100.0)) if target_kg > 0 else 100.0

    return {
        "pending_tbs_kg": round(pending_tbs_kg, 2),
        "pending_berondol_kg": round(pending_berondol_kg, 2),
        "total_pending_kg": round(total_pending_kg, 2),
        "wac_tbs": round(wac_tbs, 2),
        "wac_berondol": round(wac_berondol, 2),
        "total_pending_value": round(total_pending_value, 2),
        "target_kg": target_kg,
        "target_progress_pct": round(target_progress_pct, 1),
        "total_tbs_bought_kg": round(total_tbs_bought_kg, 2),
        "total_berondol_bought_kg": round(total_berondol_bought_kg, 2),
        "total_grade_b_returned_kg": round(total_grade_b_returned_kg, 2)
    }

@api_router.get("/stock-pool")
async def get_stock_pool_status():
    return await compute_virtual_stock_pool()


# ----------------- PURCHASES (ENTRI TIMBANG LAPANGAN) ----------------- #

@api_router.get("/purchases")
async def list_purchases(limit: int = 100):
    cursor = db.purchase_transactions.find().sort("timestamp", -1).limit(limit)
    items = await cursor.to_list(limit)
    return [convert_mongo_id(item) for item in items]

@api_router.post("/purchases")
async def create_purchase(payload: PurchaseTransactionCreate):
    local_id = payload.local_id or f"PUR-{uuid.uuid4().hex[:10].upper()}"
    ts = payload.timestamp or datetime.now(timezone.utc).isoformat()
    total = payload.total_cost if payload.total_cost is not None else (payload.field_weight_kg * payload.price_per_kg)
    
    # Auto register farmer if not existing
    farmer_name = payload.farmer_name.strip()
    if farmer_name:
        existing_farmer = await db.farmers.find_one({"name": {"$regex": f"^{farmer_name}$", "$options": "i"}})
        if not existing_farmer:
            await db.farmers.insert_one({
                "name": farmer_name,
                "village": "Makekal Hulu",
                "phone": "",
                "notes": "Dibuat otomatis dari timbangan",
                "created_at": ts
            })

    # Update last price in settings
    if payload.commodity_type.upper() == "BERONDOL":
        await db.app_settings.update_one({"setting_id": "default"}, {"$set": {"last_price_berondol": payload.price_per_kg}})
    else:
        await db.app_settings.update_one({"setting_id": "default"}, {"$set": {"last_price_tbs": payload.price_per_kg}})

    doc = {
        "local_id": local_id,
        "farmer_name": farmer_name,
        "commodity_type": payload.commodity_type.upper(),
        "field_weight_kg": float(payload.field_weight_kg),
        "price_per_kg": float(payload.price_per_kg),
        "total_cost": round(float(total), 2),
        "photo_url": payload.photo_url or "",
        "notes": payload.notes or "",
        "status": payload.status or "PAID",
        "timestamp": ts,
        "synced_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Check if duplicate local_id already exists (idempotent sync)
    existing = await db.purchase_transactions.find_one({"local_id": local_id})
    if existing:
        await db.purchase_transactions.update_one({"local_id": local_id}, {"$set": doc})
        doc_res = convert_mongo_id(doc)
        doc_res["id"] = str(existing["_id"])
        return doc_res

    res = await db.purchase_transactions.insert_one(doc)
    doc_res = convert_mongo_id(doc)
    doc_res["id"] = str(res.inserted_id)
    return doc_res


# ----------------- SALES TRIPS (JUAL KE LOADING) ----------------- #

@api_router.get("/trips")
async def list_sales_trips(limit: int = 100):
    cursor = db.sales_trips.find().sort("trip_date", -1).limit(limit)
    items = await cursor.to_list(limit)
    return [convert_mongo_id(item) for item in items]

@api_router.post("/trips")
async def create_sales_trip(payload: SalesTripCreate):
    local_id = payload.local_id or f"TRIP-{uuid.uuid4().hex[:10].upper()}"
    trip_date = payload.trip_date or datetime.now(timezone.utc).isoformat()

    # Get current WAC for COGS allocation
    pool = await compute_virtual_stock_pool()
    wac = pool["wac_berondol"] if payload.commodity_type.upper() == "BERONDOL" else pool["wac_tbs"]

    dispatched_w = float(payload.dispatched_weight_kg)
    loading_w = float(payload.loading_weight_kg)

    # Susut Timbangan
    weight_loss_kg = max(0.0, dispatched_w - loading_w)
    weight_loss_pct = (weight_loss_kg / dispatched_w * 100.0) if dispatched_w > 0 else 0.0

    # Potongan Wajib 2% pada berat loading
    deduction_2pct_kg = loading_w * 0.02
    billable_weight_kg = loading_w * 0.98

    # Grade splits
    grade_a = payload.grade_a or GradeSplit()
    grade_b_sold = payload.grade_b_sold or GradeSplit()
    retur_b_kg = float(payload.grade_b_returned_kg)

    rev_a = grade_a.weight_kg * grade_a.price_per_kg if grade_a.revenue == 0 else grade_a.revenue
    rev_b = grade_b_sold.weight_kg * grade_b_sold.price_per_kg if grade_b_sold.revenue == 0 else grade_b_sold.revenue
    total_revenue = rev_a + rev_b

    # COGS allocated: Dispatched weight minus returned Grade B (which stays in Berondol pool)
    net_dispatched_sold_kg = max(0.0, dispatched_w - retur_b_kg)
    cogs_allocated = payload.cogs_allocated if payload.cogs_allocated is not None else (net_dispatched_sold_kg * wac)

    # Logistics Calculation
    # Transport: Total dispatched / loading tonase * rate per ton
    tonase = dispatched_w / 1000.0
    transport_cost = payload.transport_cost if payload.transport_cost is not None else (tonase * payload.transport_rate_per_ton)

    # Bongkar Muat: Berat loading * rate
    unloading_cost = payload.unloading_cost
    if unloading_cost is None:
        if payload.commodity_type.upper() == "BERONDOL":
            unloading_cost = loading_w * payload.unloading_rate_berondol
        else:
            unloading_cost = loading_w * payload.unloading_rate_tbs

    tips = float(payload.tips)
    total_logistic_expenses = transport_cost + unloading_cost + tips

    # Net Trade Margin
    net_margin = total_revenue - cogs_allocated - total_logistic_expenses

    # Settings for anomaly threshold
    settings = await db.app_settings.find_one({"setting_id": "default"}) or {}
    shrinkage_threshold = float(settings.get("shrinkage_alert_pct", 5.0))
    is_anomaly = weight_loss_pct > shrinkage_threshold

    doc = {
        "local_id": local_id,
        "trip_date": trip_date,
        "loading_name": payload.loading_name or "Loading RAM Makekal",
        "nota_number": payload.nota_number or f"NOTA-{local_id[-6:]}",
        "commodity_type": payload.commodity_type.upper(),
        "dispatched_weight_kg": round(dispatched_w, 2),
        "loading_weight_kg": round(loading_w, 2),
        "weight_loss_kg": round(weight_loss_kg, 2),
        "weight_loss_pct": round(weight_loss_pct, 2),
        "is_anomaly": is_anomaly,
        "deduction_2pct_kg": round(deduction_2pct_kg, 2),
        "billable_weight_kg": round(billable_weight_kg, 2),
        "grade_a": {
            "weight_kg": round(grade_a.weight_kg, 2),
            "price_per_kg": round(grade_a.price_per_kg, 2),
            "revenue": round(rev_a, 2)
        },
        "grade_b_sold": {
            "weight_kg": round(grade_b_sold.weight_kg, 2),
            "price_per_kg": round(grade_b_sold.price_per_kg, 2),
            "revenue": round(rev_b, 2)
        },
        "grade_b_returned_kg": round(retur_b_kg, 2),
        "cogs_allocated": round(cogs_allocated, 2),
        "wac_unit_applied": round(wac, 2),
        "transport_rate_per_ton": payload.transport_rate_per_ton,
        "transport_cost": round(transport_cost, 2),
        "unloading_cost": round(unloading_cost, 2),
        "tips": round(tips, 2),
        "total_logistic_expenses": round(total_logistic_expenses, 2),
        "total_revenue": round(total_revenue, 2),
        "net_margin": round(net_margin, 2),
        "payment_status": payload.payment_status.upper(),
        "due_date": payload.due_date,
        "notes": payload.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "synced_at": datetime.now(timezone.utc).isoformat()
    }

    existing = await db.sales_trips.find_one({"local_id": local_id})
    if existing:
        await db.sales_trips.update_one({"local_id": local_id}, {"$set": doc})
        doc_res = convert_mongo_id(doc)
        doc_res["id"] = str(existing["_id"])
        return doc_res

    res = await db.sales_trips.insert_one(doc)
    doc_res = convert_mongo_id(doc)
    doc_res["id"] = str(res.inserted_id)
    return doc_res

@api_router.patch("/trips/{trip_id}/pay")
async def mark_trip_paid(trip_id: str, current_user: dict = Depends(get_current_user)):
    # Can find by MongoDB _id or local_id
    query = {"local_id": trip_id}
    trip = await db.sales_trips.find_one(query)
    if not trip:
        try:
            from bson import ObjectId
            trip = await db.sales_trips.find_one({"_id": ObjectId(trip_id)})
            query = {"_id": ObjectId(trip_id)}
        except Exception:
            pass

    if not trip:
        raise HTTPException(status_code=404, detail="Data trip tidak ditemukan")

    await db.sales_trips.update_one(query, {"$set": {"payment_status": "COD", "paid_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Status pembayaran berhasil diubah menjadi Lunas (COD)"}


# ----------------- OPERATIONAL EXPENSES (BIAYA TERISOLASI) ----------------- #

@api_router.get("/expenses")
async def list_expenses(limit: int = 100):
    cursor = db.operational_expenses.find().sort("timestamp", -1).limit(limit)
    items = await cursor.to_list(limit)
    return [convert_mongo_id(item) for item in items]

@api_router.post("/expenses")
async def create_expense(payload: OperationalExpenseCreate):
    local_id = payload.local_id or f"EXP-{uuid.uuid4().hex[:10].upper()}"
    ts = payload.timestamp or datetime.now(timezone.utc).isoformat()

    doc = {
        "local_id": local_id,
        "category": payload.category,
        "amount": round(float(payload.amount), 2),
        "description": payload.description,
        "worker_count": int(payload.worker_count or 0),
        "timestamp": ts,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "synced_at": datetime.now(timezone.utc).isoformat()
    }

    existing = await db.operational_expenses.find_one({"local_id": local_id})
    if existing:
        await db.operational_expenses.update_one({"local_id": local_id}, {"$set": doc})
        doc_res = convert_mongo_id(doc)
        doc_res["id"] = str(existing["_id"])
        return doc_res

    res = await db.operational_expenses.insert_one(doc)
    doc_res = convert_mongo_id(doc)
    doc_res["id"] = str(res.inserted_id)
    return doc_res


# ----------------- BATCH SYNC ENGINE ----------------- #

@api_router.post("/sync")
async def batch_sync(payload: BatchSyncPayload):
    purchases_synced = 0
    trips_synced = 0
    expenses_synced = 0

    for p in payload.purchases:
        try:
            await create_purchase(p)
            purchases_synced += 1
        except Exception as e:
            logger.error("Sync purchase error: %s", e)

    for t in payload.trips:
        try:
            await create_sales_trip(t)
            trips_synced += 1
        except Exception as e:
            logger.error("Sync trip error: %s", e)

    for ex in payload.expenses:
        try:
            await create_expense(ex)
            expenses_synced += 1
        except Exception as e:
            logger.error("Sync expense error: %s", e)

    pool = await compute_virtual_stock_pool()
    return {
        "status": "success",
        "synced_counts": {
            "purchases": purchases_synced,
            "trips": trips_synced,
            "expenses": expenses_synced,
            "total": purchases_synced + trips_synced + expenses_synced
        },
        "stock_pool": pool,
        "server_time": datetime.now(timezone.utc).isoformat()
    }


# ----------------- DASHBOARD METRICS & AUDIT ----------------- #

@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    # 1. Pool Status
    pool = await compute_virtual_stock_pool()

    # 2. Trips Aggregation
    trips = await db.sales_trips.find().sort("trip_date", -1).to_list(1000)
    purchases = await db.purchase_transactions.find().to_list(5000)
    expenses = await db.operational_expenses.find().to_list(1000)

    total_revenue = sum(float(t.get("total_revenue", 0.0)) for t in trips)
    total_cogs = sum(float(t.get("cogs_allocated", 0.0)) for t in trips)
    total_logistics = sum(float(t.get("total_logistic_expenses", 0.0)) for t in trips)
    total_net_margin = sum(float(t.get("net_margin", 0.0)) for t in trips)

    # Isolated Operational Expenses
    total_operational_expenses = sum(float(e.get("amount", 0.0)) for e in expenses)
    # Total Coop Net Profit = Margin Dagang Bersih - Beban Operasional Terisolasi
    coop_net_profit = total_net_margin - total_operational_expenses

    # Total Purchase Volume
    total_purchase_cost = sum(float(p.get("total_cost", 0.0)) for p in purchases)
    total_purchase_weight = sum(float(p.get("field_weight_kg", 0.0)) for p in purchases)

    # Anomaly Trips (> 5% Shrinkage)
    settings = await db.app_settings.find_one({"setting_id": "default"}) or {}
    shrinkage_threshold = float(settings.get("shrinkage_alert_pct", 5.0))

    anomaly_trips = []
    pending_receivables = []  # Piutang Loading

    for t in trips:
        t_clean = convert_mongo_id(t)
        loss_pct = float(t.get("weight_loss_pct", 0.0))
        if loss_pct > shrinkage_threshold:
            t_clean["is_anomaly"] = True
            anomaly_trips.append(t_clean)

        if t.get("payment_status", "COD").upper() == "PENDING":
            pending_receivables.append(t_clean)

    total_receivables_amount = sum(float(t.get("total_revenue", 0.0)) for t in pending_receivables)

    # Recent Transactions
    recent_purchases = [convert_mongo_id(p) for p in purchases[-10:]]
    recent_trips = [convert_mongo_id(t) for t in trips[:10]]

    return {
        "stock_pool": pool,
        "financial_summary": {
            "total_revenue": round(total_revenue, 2),
            "total_cogs": round(total_cogs, 2),
            "total_logistics": round(total_logistics, 2),
            "total_net_margin": round(total_net_margin, 2),
            "total_operational_expenses": round(total_operational_expenses, 2),
            "coop_net_profit": round(coop_net_profit, 2),
            "total_purchase_cost": round(total_purchase_cost, 2),
            "total_purchase_weight_kg": round(total_purchase_weight, 2),
            "total_receivables_amount": round(total_receivables_amount, 2),
            "pending_receivables_count": len(pending_receivables),
            "anomaly_trips_count": len(anomaly_trips),
            "shrinkage_threshold_pct": shrinkage_threshold
        },
        "anomaly_trips": anomaly_trips,
        "pending_receivables": pending_receivables,
        "recent_purchases": recent_purchases,
        "recent_trips": recent_trips
    }


# ----------------- DEMO SEEDER ----------------- #

@api_router.post("/seed-demo")
async def seed_demo_data():
    # Clear previous operational data but keep farmers and admin
    await db.purchase_transactions.delete_many({})
    await db.sales_trips.delete_many({})
    await db.operational_expenses.delete_many({})

    now = datetime.now(timezone.utc)

    # 1. Sample Purchases (TBS & Berondol)
    demo_purchases = [
        {"local_id": "PUR-DEMO001", "farmer_name": "Pak Budi Makekal", "commodity_type": "TBS", "field_weight_kg": 650.0, "price_per_kg": 2450.0, "total_cost": 1592500.0, "status": "PAID", "timestamp": (now - timedelta(days=2, hours=3)).isoformat()},
        {"local_id": "PUR-DEMO002", "farmer_name": "Pak Tumenggung Marituha", "commodity_type": "TBS", "field_weight_kg": 850.0, "price_per_kg": 2450.0, "total_cost": 2082500.0, "status": "PAID", "timestamp": (now - timedelta(days=2, hours=1)).isoformat()},
        {"local_id": "PUR-DEMO003", "farmer_name": "Pak Nyenong", "commodity_type": "BERONDOL", "field_weight_kg": 220.0, "price_per_kg": 2700.0, "total_cost": 594000.0, "status": "PAID", "timestamp": (now - timedelta(days=1, hours=5)).isoformat()},
        {"local_id": "PUR-DEMO004", "farmer_name": "Pak Ngotap", "commodity_type": "TBS", "field_weight_kg": 780.0, "price_per_kg": 2480.0, "total_cost": 1934400.0, "status": "PAID", "timestamp": (now - timedelta(days=1, hours=2)).isoformat()},
        {"local_id": "PUR-DEMO005", "farmer_name": "Bu Siti Aminah", "commodity_type": "TBS", "field_weight_kg": 520.0, "price_per_kg": 2450.0, "total_cost": 1274000.0, "status": "PAID", "timestamp": (now - timedelta(hours=4)).isoformat()},
        {"local_id": "PUR-DEMO006", "farmer_name": "Pak Hasan Basri", "commodity_type": "BERONDOL", "field_weight_kg": 180.0, "price_per_kg": 2700.0, "total_cost": 486000.0, "status": "PAID", "timestamp": (now - timedelta(hours=2)).isoformat()},
    ]
    await db.purchase_transactions.insert_many(demo_purchases)

    # 2. Sample Trips: 1 Normal Trip and 1 Anomaly Trip (>5% shrinkage) and 1 Pending Piutang
    demo_trips = [
        {
            "local_id": "TRIP-DEMO001",
            "trip_date": (now - timedelta(days=1)).isoformat(),
            "loading_name": "RAM Sawit Sejahtera",
            "nota_number": "NOTA-RAM-881",
            "commodity_type": "TBS",
            "dispatched_weight_kg": 1500.0,
            "loading_weight_kg": 1475.0,  # susut 25 kg (1.67% - Normal)
            "weight_loss_kg": 25.0,
            "weight_loss_pct": 1.67,
            "is_anomaly": False,
            "deduction_2pct_kg": 29.5,
            "billable_weight_kg": 1445.5,
            "grade_a": {"weight_kg": 1400.0, "price_per_kg": 2650.0, "revenue": 3710000.0},
            "grade_b_sold": {"weight_kg": 45.5, "price_per_kg": 2200.0, "revenue": 100100.0},
            "grade_b_returned_kg": 0.0,
            "cogs_allocated": 3675000.0,
            "wac_unit_applied": 2450.0,
            "transport_rate_per_ton": 70000.0,
            "transport_cost": 105000.0,
            "unloading_cost": 36875.0,
            "tips": 20000.0,
            "total_logistic_expenses": 161875.0,
            "total_revenue": 3810100.0,
            "net_margin": -26775.0,
            "payment_status": "COD",
            "notes": "Trip perdana lancar.",
            "created_at": (now - timedelta(days=1)).isoformat()
        },
        {
            "local_id": "TRIP-DEMO002",
            "trip_date": (now - timedelta(hours=6)).isoformat(),
            "loading_name": "RAM Utama Mandiri",
            "nota_number": "NOTA-RAM-904",
            "commodity_type": "TBS",
            "dispatched_weight_kg": 800.0,
            "loading_weight_kg": 745.0,  # susut 55 kg (6.88% - ANOMALI > 5%)
            "weight_loss_kg": 55.0,
            "weight_loss_pct": 6.88,
            "is_anomaly": True,
            "deduction_2pct_kg": 14.9,
            "billable_weight_kg": 730.1,
            "grade_a": {"weight_kg": 680.0, "price_per_kg": 2700.0, "revenue": 1836000.0},
            "grade_b_sold": {"weight_kg": 50.1, "price_per_kg": 2300.0, "revenue": 115230.0},
            "grade_b_returned_kg": 20.0,  # retur bawa pulang 20kg
            "cogs_allocated": 1911000.0,
            "wac_unit_applied": 2450.0,
            "transport_rate_per_ton": 70000.0,
            "transport_cost": 56000.0,
            "unloading_cost": 18625.0,
            "tips": 10000.0,
            "total_logistic_expenses": 84625.0,
            "total_revenue": 1951230.0,
            "net_margin": -44395.0,
            "payment_status": "PENDING",
            "due_date": (now + timedelta(days=3)).strftime("%Y-%m-%d"),
            "notes": "Susut tinggi karena cuaca panas & selisih timbang loading.",
            "created_at": (now - timedelta(hours=6)).isoformat()
        }
    ]
    await db.sales_trips.insert_many(demo_trips)

    # 3. Sample Operational Expenses
    demo_expenses = [
        {"local_id": "EXP-DEMO001", "category": "Makan Pekerja", "amount": 75000.0, "description": "Makan siang 3 buruh timbang", "worker_count": 3, "timestamp": (now - timedelta(days=1, hours=3)).isoformat()},
        {"local_id": "EXP-DEMO002", "category": "BBM/Transport Lapangan", "amount": 50000.0, "description": "Bensin genset penerangan timbangan", "worker_count": 0, "timestamp": (now - timedelta(hours=5)).isoformat()},
        {"local_id": "EXP-DEMO003", "category": "Dana Sosial", "amount": 25000.0, "description": "Kas pembinaan warga Orang Rimba", "worker_count": 0, "timestamp": (now - timedelta(hours=1)).isoformat()},
    ]
    await db.operational_expenses.insert_many(demo_expenses)

    return {"message": "Data simulasi demo berhasil dimuat!", "stats": await get_dashboard_stats()}


# Include API router
app.include_router(api_router)

# CORS configuration
cors_origins_env = os.environ.get("CORS_ORIGINS", "")
if cors_origins_env and cors_origins_env != "*":
    origins_list = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
else:
    origins_list = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://palm-ledger-hub.preview.emergentagent.com"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins_list,
    allow_origin_regex=r"^https?://.*\.preview\.emergentagent\.com$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
