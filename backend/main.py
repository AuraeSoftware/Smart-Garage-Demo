"""
WashPro Backend — FastAPI + PostgreSQL
OS2 Studio · Dindigul, Tamil Nadu

Role hierarchy:
  SupremeAdmin  = Platform owner (OS2 Studio) — full access
  Admin         = Retailer — packages/QR/loyalty/washers, no branches/SuperAdmin
  SuperAdmin    = Branch Admin — scoped to their branch_id only
  Washer        = Washer App user
"""
import json
import os
import platform
import platform
from datetime import datetime, timedelta
from typing import Optional
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# WORKAROUND: Python 3.14 on some Windows machines hangs on WMI queries during platform.machine()
platform.machine = lambda: "AMD64"
platform.win32_ver = lambda *a, **k: ("", "", "", "")

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, WebSocket, WebSocketDisconnect, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

import models
import auth as auth_utils
from database import Base, engine, get_db
from seed import seed

app = FastAPI(title="WashPro API", version="2.0.0")

# ── CORS — allow both localhost and 127.0.0.1 for local dev ──
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

def build_allowed_origins():
    origins = set()
    # Always allow common local dev origins
    for port in ["3000", "3001", "5173", "5174", "8080"]:
        origins.add(f"http://localhost:{port}")
        origins.add(f"http://127.0.0.1:{port}")
    # FRONTEND_URL may hold several comma-separated URLs; split them, strip
    # whitespace, and remove any trailing slash so they match the exact origin
    # the browser sends (e.g. "https://smartgarage360.com", no trailing "/").
    if FRONTEND_URL and FRONTEND_URL != "*":
        for u in FRONTEND_URL.split(","):
            u = u.strip().rstrip("/")
            if u:
                origins.add(u)
    return list(origins)

ALLOWED_ORIGINS = build_allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        # Each entry: {"ws": WebSocket, "role": str, "branch_id": str|None, "user_id": int}
        self.connections: list[dict] = []

    async def connect(self, websocket: WebSocket, user_id: int, role: str, branch_id):
        await websocket.accept()
        self.connections.append({"ws": websocket, "role": role, "branch_id": branch_id, "user_id": user_id})

    def disconnect(self, websocket: WebSocket):
        self.connections = [c for c in self.connections if c["ws"] is not websocket]

    async def broadcast(self, message: str):
        """Legacy: broadcast raw string to all connections."""
        dead = []
        for conn in self.connections:
            try:
                await conn["ws"].send_text(message)
            except Exception:
                dead.append(conn["ws"])
        for ws in dead:
            self.disconnect(ws)

    async def broadcast_event(self, event_type: str, payload: dict, branch_id=None, roles=None):
        """
        Send a typed JSON event to matching connections.
        - branch_id: if set, only send to connections with that branch_id OR SupremeAdmin
        - roles: if set (list), only send to connections with one of those roles
        """
        message = json.dumps({"type": event_type, "payload": payload})
        dead = []
        for conn in self.connections:
            # Role filter
            if roles and conn["role"] not in roles:
                continue
            # Branch filter: SupremeAdmin sees everything; others only their branch
            if branch_id is not None:
                if conn["role"] != "SupremeAdmin" and conn["branch_id"] != branch_id:
                    continue
            try:
                await conn["ws"].send_text(message)
            except Exception:
                dead.append(conn["ws"])
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    if not token:
        await websocket.close(code=1008)
        return
    
    payload = auth_utils.decode_token(token)
    if not payload:
        await websocket.close(code=1008)
        return

    user_id = int(payload.get("sub", 0))
    role = payload.get("role", "")
    # Look up branch_id from DB
    from database import SessionLocal as _SL
    _db = _SL()
    branch_id = None
    try:
        _u = _db.query(models.User).filter(models.User.id == user_id).first()
        if _u:
            branch_id = _u.branch_id
    finally:
        _db.close()
        
    await manager.connect(websocket, user_id, role, branch_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle ping from client to keep alive
            if data == "ping":
                try:
                    await websocket.send_text(json.dumps({"type": "pong"}))
                except Exception:
                    break
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.on_event("startup")
def startup_event():
    import time
    max_retries = 10
    connected = False
    for i in range(max_retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            connected = True
            break
        except Exception as e:
            print(f"Database connection attempt {i+1} failed (waking up?): {e}")
            time.sleep(3)

    if not connected:
        print("CRITICAL: Could not connect to the database after several retries. Exiting.")
        raise RuntimeError("Database connection failed")

    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"create_all error: {e}")
        raise e

    # Column migrations — safe to run on every boot
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE branches ADD COLUMN IF NOT EXISTS subscription VARCHAR(30) DEFAULT 'trial'"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password VARCHAR(200)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(200)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(50)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_make VARCHAR(100)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR(100)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription VARCHAR(30) DEFAULT 'trial'"))
            conn.execute(text("ALTER TABLE inventory_items DROP COLUMN IF EXISTS unit"))
            conn.execute(text("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS price FLOAT DEFAULT 0.0"))
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS price FLOAT DEFAULT 0.0"))
            conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100)"))
            conn.execute(text("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS products JSON"))
            conn.execute(text("ALTER TABLE packages ADD COLUMN IF NOT EXISTS products TEXT"))
            conn.execute(text("ALTER TABLE branches ADD COLUMN IF NOT EXISTS expiry_date VARCHAR(30)"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS has_multiple_branches BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS monthly_price FLOAT"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS annual_price FLOAT"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_branches INTEGER"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS report_access VARCHAR(50) DEFAULT 'All'"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS has_ai_scanning BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS has_payment_gateway BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS has_loyalty BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS has_reports BOOLEAN DEFAULT FALSE"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_washers INTEGER"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_sessions INTEGER"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#6366f1'"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features JSON"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price_inr VARCHAR(50)"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS monthly_price_inr FLOAT"))
            conn.execute(text("ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS annual_price_inr FLOAT"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS tracking_id VARCHAR(100)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_info JSON"))
            conn.execute(text("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS used_washes INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE branches ADD COLUMN IF NOT EXISTS company_reg_no VARCHAR(100)"))
            conn.execute(text("ALTER TABLE customer_job_requests ADD COLUMN IF NOT EXISTS address VARCHAR(300)"))
            conn.commit()
    except Exception as e:
        print(f"Migration note: {e}")

    from database import SessionLocal
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()

def calculate_expiry_date(duration: str):
    if not duration: return None
    dur = duration.lower()
    days = 0
    if "day" in dur:
        try:
            days = int(''.join(filter(str.isdigit, dur)))
        except: pass
    elif "month" in dur:
        days = 30
    elif "year" in dur:
        days = 365
    if days > 0:
        return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")
    return None


# ════════════════════════════════════════════════════════════
# AUTH HELPERS
# ════════════════════════════════════════════════════════════
def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    raw_token = authorization.split(" ", 1)[1]
    payload   = auth_utils.decode_token(raw_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    try:
        user_id = int(payload.get("sub", 0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.status == "Suspended":
        raise HTTPException(status_code=401, detail="Account suspended")
    if user.status == "Pending" and user.role not in ("SuperAdmin", "IndividualUser"):
        raise HTTPException(status_code=401, detail="Account pending approval")
    return user

def require_super_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ("SupremeAdmin",):
        raise HTTPException(status_code=403, detail="SupremeAdmin access required")
    return current_user

def require_admin_or_super_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ("SuperAdmin", "SupremeAdmin", "Admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

require_admin = require_admin_or_super_admin

def get_owned_branch_ids(db: Session, user: models.User) -> list:
    if user.role == "SupremeAdmin":
        return [b.id for b in db.query(models.Branch).all()]
    elif user.role == "SuperAdmin":
        owned = db.query(models.Branch).filter(models.Branch.owner_id == user.id).all()
        b_ids = [b.id for b in owned]
        if user.branch_id and user.branch_id not in b_ids:
            b_ids.append(user.branch_id)
        return b_ids
    elif user.role in ("Admin", "Washer"):
        return [user.branch_id] if user.branch_id else []


# ════════════════════════════════════════════════════════════
# COUNTER HELPERS
# ════════════════════════════════════════════════════════════
def next_invoice_number(db: Session) -> str:
    setting = db.query(models.Setting).filter(models.Setting.key == "inv_counter").with_for_update().first()
    current = int(setting.value)
    nxt     = current + 1
    setting.value = str(nxt)
    db.commit()
    return f"INV-CAR{str(nxt).zfill(3)}"

def next_customer_id(db: Session) -> str:
    setting = db.query(models.Setting).filter(models.Setting.key == "cus_counter").with_for_update().first()
    current = int(setting.value)
    nxt     = current + 1
    setting.value = str(nxt)
    db.commit()
    return f"CUS-{str(nxt).zfill(3)}"


# ════════════════════════════════════════════════════════════
# SCHEMAS
# ════════════════════════════════════════════════════════════
class LoginRequest(BaseModel):
    username: str
    password: str

class SignupSuperAdmin(BaseModel):
    name: str; username: str; password: str; phone: str
    email: Optional[str] = None
    branch_name: str; branch_address: str; branch_phone: Optional[str] = None
    company_reg_no: Optional[str] = None
    subscription: str = "trial"
    trackingId: Optional[str] = None
    payment: Optional[dict] = None

class SignupIndividual(BaseModel):
    name: str; username: str; password: str; phone: str
    email: Optional[str] = None
    vehicle_plate: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None

class UserCreate(BaseModel):
    username: str; password: str; role: str = "Washer"; name: str
    phone: Optional[str] = None; branch_id: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None; username: Optional[str] = None
    phone: Optional[str] = None; status: Optional[str] = None
    branch_id: Optional[str] = None; password: Optional[str] = None
    subscription: Optional[str] = None
    email: Optional[str] = None

class BranchIn(BaseModel):
    id: Optional[str] = None; name: str; address: str
    phone: Optional[str] = None; manager: Optional[str] = None
    status: str = "Active"; subscription: str = "trial"
    expiry_date: Optional[str] = None

class BranchUpdate(BaseModel):
    name: Optional[str] = None; address: Optional[str] = None
    phone: Optional[str] = None; manager: Optional[str] = None
    status: Optional[str] = None; subscription: Optional[str] = None
    expiry_date: Optional[str] = None

class PackageIn(BaseModel):
    id: Optional[str] = None; name: str; desc: str = ""
    price: float; time: str = ""; color: str = "#22d3ee"; sort_order: int = 0
    products: Optional[str] = None; branch_id: Optional[str] = None

class SubscriptionPlanIn(BaseModel):
    id: Optional[str] = None; label: str; price: str; duration: str
    monthly_price: Optional[float] = None
    annual_price: Optional[float] = None
    price_inr: Optional[str] = None
    monthly_price_inr: Optional[float] = None
    annual_price_inr: Optional[float] = None
    color: str = "#6366f1"; features: list = []
    max_washers: Optional[int] = None
    max_sessions: Optional[int] = None
    max_branches: Optional[int] = None
    has_loyalty: bool = False
    has_reports: bool = False
    report_access: str = "All"
    has_ai_scanning: bool = False
    has_multiple_branches: bool = False
    has_payment_gateway: bool = False

class ProductIn(BaseModel):
    id: Optional[str] = None; name: str; desc: str = ""
    price: float = 0.0; unit_cost: float = 0.0; size: Optional[str] = None
    qty_per_unit: int = 1; clicks: Optional[int] = None
    barcode: Optional[str] = None; branch_id: Optional[str] = None

class InventoryItemIn(BaseModel):
    name: str; category: str
    quantity: float = 0.0; threshold: float = 0.0
    description: str = ""; price: float = 0.0; cost: float = 0.0
    barcode: Optional[str] = None; branch_id: Optional[str] = None
    washes_per_unit: int = 10

class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None; category: Optional[str] = None
    quantity: Optional[float] = None; threshold: Optional[float] = None
    description: Optional[str] = None; price: Optional[float] = None
    cost: Optional[float] = None; barcode: Optional[str] = None
    branch_id: Optional[str] = None; washes_per_unit: Optional[int] = None

class RestockIn(BaseModel):
    quantity: float; note: Optional[str] = None

class UseStockIn(BaseModel):
    quantity: float; note: Optional[str] = None

class SessionIn(BaseModel):
    date: str; washer_id: int; washer: str
    washer_username: Optional[str] = None
    branch_id: Optional[str] = None; branch: Optional[str] = None
    location: Optional[str] = None; location_name: Optional[str] = None
    lat: float = 0; lng: float = 0
    vehicle: dict; customer: dict; package: dict; payment: dict
    coupon: Optional[dict] = None
    products: Optional[list] = None
    original_total: float = 0; total: float = 0
    status: str = "Completed"

class PendingJobIn(BaseModel):
    id: str; customer: dict; vehicle: dict; package: dict
    geo: Optional[dict] = None; location_name: Optional[str] = None
    branch_id: str; branch: Optional[str] = None
    washer_id: int; washer: str; loyalty: Optional[dict] = None
    status: Optional[str] = None
    products: Optional[list] = None

class CustomerUpdate(BaseModel):
    notes: Optional[str] = None; name: Optional[str] = None; email: Optional[str] = None

class LoyaltyCheck(BaseModel):
    phone: str

class CouponUsage(BaseModel):
    phone: str; coupon_code: str


# ════════════════════════════════════════════════════════════
# DICT HELPERS
# ════════════════════════════════════════════════════════════
def to_iso_utc(dt):
    if not dt: return None
    return dt.isoformat()

def user_to_dict(u):
    return {
        "id": u.id, "username": u.username, "role": u.role, "name": u.name,
        "phone": u.phone, "email": getattr(u, 'email', None), "status": u.status, "avatar": u.avatar,
        "branch_id": u.branch_id, "branchId": u.branch_id, "joined": u.joined,
        "subscription": getattr(u, 'subscription', 'trial'),
        "trackingId": getattr(u, 'tracking_id', None),
        "paymentInfo": getattr(u, 'payment_info', None),
        "createdAt": to_iso_utc(u.created_at),
        "password": getattr(u, 'plain_password', None) or "••••••••",
    }

def is_washer_locked(db, user):
    if user.role != "Washer" or not user.branch_id: return False
    plan = db.query(models.SubscriptionPlan).join(models.Branch, models.Branch.subscription == models.SubscriptionPlan.id).filter(models.Branch.id == user.branch_id).first()
    if plan and plan.max_washers is not None and plan.max_washers > 0:
        older_washers = db.query(models.User).filter(
            models.User.branch_id == user.branch_id,
            models.User.role == "Washer",
            models.User.id < user.id
        ).count()
        if older_washers >= plan.max_washers: return True
        
    # Check if the branch itself is locked
    branch = db.query(models.Branch).filter_by(id=user.branch_id).first()
    if branch and is_branch_locked(db, branch): return True
        
    return False

def is_branch_locked(db, branch):
    if not branch.owner_id: return False
    owner = db.query(models.User).filter_by(id=branch.owner_id).first()
    if not owner or not owner.subscription: return False
    plan = db.query(models.SubscriptionPlan).filter_by(id=owner.subscription).first()
    if plan and plan.max_branches is not None and plan.max_branches > 0:
        # Sort branches by created_at, fallback to id
        all_branches = db.query(models.Branch).filter(models.Branch.owner_id == branch.owner_id).all()
        # Sort branches to find the oldest ones. Since created_at might be missing or string, we do our best.
        all_branches.sort(key=lambda b: str(b.created_at) if b.created_at else b.id)
        
        # If this branch's index is >= max_branches, it is locked.
        for idx, b in enumerate(all_branches):
            if b.id == branch.id:
                return idx >= plan.max_branches
    return False

def get_locked_branch_ids(db):
    owner_limits = {}
    for owner in db.query(models.User).filter(models.User.subscription.isnot(None)).all():
        plan = db.query(models.SubscriptionPlan).filter_by(id=owner.subscription).first()
        if plan and plan.max_branches is not None:
            owner_limits[owner.id] = plan.max_branches

    locked_branch_ids = set()
    branch_counts = {}
    for b_id, o_id in db.query(models.Branch.id, models.Branch.owner_id).order_by(models.Branch.created_at, models.Branch.id).all():
        if o_id in owner_limits:
            limit = owner_limits[o_id]
            if limit > 0:
                count = branch_counts.get(o_id, 0)
                if count >= limit:
                    locked_branch_ids.add(b_id)
                branch_counts[o_id] = count + 1
    return locked_branch_ids

def annotate_users_with_locks(db, users):
    locked_branch_ids = get_locked_branch_ids(db)
    
    branch_limits = {}
    for b in db.query(models.Branch).all():
        plan = db.query(models.SubscriptionPlan).filter_by(id=b.subscription).first()
        branch_limits[b.id] = plan.max_washers if plan else None
    
    washer_counts = {}
    all_washers = db.query(models.User.id, models.User.branch_id).filter(models.User.role == "Washer").order_by(models.User.id).all()
    
    locked_user_ids = set()
    for w_id, b_id in all_washers:
        if b_id in locked_branch_ids:
            locked_user_ids.add(w_id)
        else:
            limit = branch_limits.get(b_id)
            if limit is not None and limit > 0:
                count = washer_counts.get(b_id, 0)
                if count >= limit:
                    locked_user_ids.add(w_id)
                washer_counts[b_id] = count + 1

    from sqlalchemy import func
    customer_users = [u for u in users if u.role in ("IndividualUser", "Customer") and u.phone]
    customer_branches = {}
    if customer_users:
        phones = [u.phone for u in customer_users]
        subq = db.query(
            models.CustomerJobRequest.customer_phone, 
            func.max(models.CustomerJobRequest.created_at).label('max_date')
        ).filter(models.CustomerJobRequest.customer_phone.in_(phones)).group_by(models.CustomerJobRequest.customer_phone).subquery()
        latest_requests = db.query(models.CustomerJobRequest.customer_phone, models.CustomerJobRequest.branch_id).join(
            subq, 
            (models.CustomerJobRequest.customer_phone == subq.c.customer_phone) & (models.CustomerJobRequest.created_at == subq.c.max_date)
        ).all()
        for phone, branch_id in latest_requests:
            customer_branches[phone] = branch_id

    result = []
    for u in users:
        d = user_to_dict(u)
        if u.role in ("IndividualUser", "Customer") and u.phone and customer_branches.get(u.phone):
            d["branch_id"] = customer_branches[u.phone]
            d["branchId"] = customer_branches[u.phone]
        d["is_locked"] = u.id in locked_user_ids if u.role == "Washer" else False
        result.append(d)
    return result

def branch_to_dict(b):
    exp = getattr(b, "expiry_date", None)
    if exp and "/" in exp:
        parts = exp.split("/")
        if len(parts) == 3:
            exp = f"{parts[2]}-{parts[1]}-{parts[0]}"
    return {
        "id": b.id, "name": b.name, "address": b.address,
        "phone": b.phone, "manager": b.manager, "status": b.status,
        "owner_id": getattr(b, "owner_id", None),
        "subscription": getattr(b, "subscription", "trial"),
        "company_reg_no": getattr(b, "company_reg_no", None),
        "createdAt": b.created_at,
        "expiry_date": exp,
        "current_month_sessions": getattr(b, "current_month_sessions", 0),
        "max_sessions": getattr(b, "max_sessions", 0),
        "max_washers": getattr(b, "max_washers", None),
    }

def pkg_to_dict(p):
    return {"id": p.id, "name": p.name, "desc": p.desc, "price": p.price, "time": p.time, "color": p.color, "products": getattr(p, 'products', None), "branch_id": getattr(p, 'branch_id', None)}

def subplan_to_dict(sp):
    return {
        "id": sp.id, "label": sp.label, "price": sp.price, "duration": sp.duration,
        "monthly_price": getattr(sp, 'monthly_price', None),
        "annual_price": getattr(sp, 'annual_price', None),
        "price_inr": getattr(sp, 'price_inr', None),
        "monthly_price_inr": getattr(sp, 'monthly_price_inr', None),
        "annual_price_inr": getattr(sp, 'annual_price_inr', None),
        "color": sp.color, "features": sp.features,
        "max_washers": sp.max_washers, "max_sessions": sp.max_sessions,
        "max_branches": getattr(sp, 'max_branches', None),
        "has_loyalty": sp.has_loyalty, "has_reports": sp.has_reports,
        "report_access": getattr(sp, 'report_access', 'All'),
        "has_ai_scanning": sp.has_ai_scanning,
        "has_multiple_branches": getattr(sp, 'has_multiple_branches', False),
        "has_payment_gateway": getattr(sp, 'has_payment_gateway', False)
    }

def prod_to_dict(p):
    return {
        "id": p.id, "name": p.name, "desc": p.desc,
        "size": getattr(p, 'size', None),
        "price": getattr(p, 'price', 0.0),
        "unit_cost": p.unit_cost, 
        "qty_per_unit": getattr(p, 'qty_per_unit', 1),
        "clicks": getattr(p, 'clicks', 1),
        "barcode": getattr(p, 'barcode', None),
        "branch_id": p.branch_id,
        "createdAt": to_iso_utc(p.created_at)
    }

def inventory_item_to_dict(item):
    qty = getattr(item, 'quantity', 0.0) or 0.0
    used = getattr(item, 'used_washes', 0) or 0
    clicks = int(qty)
    return {
        "id": item.id, "name": item.name, "category": item.category,
        "quantity": qty, "threshold": item.threshold,
        "description": item.description, "price": getattr(item, 'price', 0.0),
        "cost": item.cost, "barcode": getattr(item, 'barcode', None),
        "branch_id": item.branch_id, "is_active": item.is_active,
        "washes_per_unit": getattr(item, 'washes_per_unit', 10),
        "used_washes": used,
        "clicks": clicks,
        "low_stock": clicks <= (item.threshold or 3),
        "created_at": to_iso_utc(item.created_at),
        "updated_at": to_iso_utc(item.updated_at),
    }

def inventory_history_to_dict(h):
    return {
        "id": h.id, "item_id": h.item_id, "event_type": h.event_type,
        "quantity_change": h.quantity_change, "created_by": h.created_by,
        "created_at": to_iso_utc(h.created_at),
    }

def session_to_dict(s):
    return {
        "id": s.id, "date": s.date,
        "washerId": s.washer_id, "washer": s.washer,
        "washerUsername": s.washer_username,
        "branchId": s.branch_id, "branch": s.branch,
        "location": s.location, "locationName": s.location_name,
        "lat": s.lat, "lng": s.lng,
        "vehicle": s.vehicle, "customer": s.customer,
        "package": s.package, "payment": s.payment,
        "coupon": s.coupon, "products": getattr(s, 'products', None),
        "originalTotal": s.original_total, "total": s.total,
        "status": s.status,
        "createdAt": to_iso_utc(s.created_at),
    }

def job_to_dict(j):
    return {
        "id": j.id, "customer": j.customer, "vehicle": j.vehicle,
        "package": j.package, "geo": j.geo, "locationName": j.location_name,
        "branchId": j.branch_id, "branch": j.branch,
        "washerId": j.washer_id, "washer": j.washer, "loyalty": j.loyalty,
        "products": getattr(j, 'products', None),
        "submittedAt": to_iso_utc(j.submitted_at),
        "status": j.status,
    }

def cust_to_dict(c):
    return {
        "id": c.id, "name": c.name, "phone": c.phone, "email": c.email,
        "branchId": c.branch_id, "totalSpend": c.total_spend,
        "lastVisit": c.last_visit,
        "joinedAt": to_iso_utc(c.joined_at),
        "notes": c.notes or "", "couponsRedeemed": c.coupons_redeemed,
        "lastCouponUsed": to_iso_utc(c.last_coupon_used),
        "visits": c.visits or [], "couponHistory": c.coupon_history or [],
    }


# ════════════════════════════════════════════════════════════
# HEALTH
# ════════════════════════════════════════════════════════════
@app.get("/api/health")
def health():
    return {"status": "ok", "service": "WashPro API"}


# ════════════════════════════════════════════════════════════
# AUTH
# ════════════════════════════════════════════════════════════
@app.post("/api/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == body.username).first()
    if not user or user.status == "Suspended":
        raise HTTPException(status_code=401, detail="Invalid credentials or account suspended")
    if user.status == "Rejected":
        raise HTTPException(status_code=403, detail="ACCOUNT_REJECTED")
    if user.status == "Pending":
        if user.role == "SuperAdmin":
            raise HTTPException(status_code=403, detail="PENDING_APPROVAL")
        elif user.role == "IndividualUser":
            pass
    if not auth_utils.verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials or account suspended")

    # Removed expiration check here so expired users can still login and access "My Plan" page to upgrade

    access_token = auth_utils.create_token({"sub": user.id, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "user": user_to_dict(user)}

@app.get("/api/auth/me")
def get_me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    d = user_to_dict(current_user)
    if current_user.role == "Washer":
        d["is_locked"] = is_washer_locked(db, current_user)
    return d

# ── Forgot / Reset Password ───────────────────────────────
class ForgotPasswordRequest(BaseModel):
    contact: str

class ResetPasswordRequest(BaseModel):
    contact: str
    code: str
    new_password: str

def send_sms_otp(phone: str, code: str):
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_phone = os.getenv("TWILIO_PHONE_NUMBER")
    if not all([account_sid, auth_token, from_phone]):
        print(f"[Twilio disabled] SMS OTP for {phone}: {code}")
        return
    try:
        from twilio.rest import Client
        client = Client(account_sid, auth_token)
        message = client.messages.create(
            body=f"Your WashPro password reset code is: {code}. It is valid for {int(os.getenv('OTP_EXPIRY', 300)) // 60} minutes.",
            from_=from_phone,
            to=phone
        )
        print(f"SMS sent successfully: {message.sid}")
    except ImportError:
        print(f"[Twilio missing] Please install twilio to send SMS. SMS OTP for {phone}: {code}")
    except Exception as e:
        print(f"Failed to send SMS: {e}")

def send_email_otp(email: str, code: str):
    api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("EMAIL_FROM")
    if not all([api_key, from_email]):
        print(f"[SendGrid disabled] Email OTP for {email}: {code}")
        return
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        message = Mail(
            from_email=from_email,
            to_emails=email,
            subject='WashPro Password Reset',
            html_content=f'<strong>Your WashPro password reset code is: {code}</strong>. It is valid for {int(os.getenv("OTP_EXPIRY", 300)) // 60} minutes.'
        )
        sg = SendGridAPIClient(api_key)
        sg.send(message)
        print(f"Email sent successfully to {email}")
    except ImportError:
        print(f"[SendGrid missing] Please install sendgrid to send emails. Email OTP for {email}: {code}")
    except Exception as e:
        print(f"Failed to send email: {e}")

@app.post("/api/auth/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    import random
    from datetime import datetime, timedelta
    
    users = db.query(models.User).filter(
        (models.User.phone == body.contact) | (models.User.email == body.contact) | (models.User.username == body.contact)
    ).all()
    
    if not users:
        raise HTTPException(404, "No account found with that contact info")
        
    code = str(random.randint(100000, 999999))
    expiry = datetime.utcnow() + timedelta(seconds=int(os.getenv("OTP_EXPIRY", 300)))
    
    for u in users:
        u.reset_code = code
        u.reset_code_expiry = expiry
    db.commit()
    
    # Check if contact is an email or phone
    user = users[0]
    if "@" in body.contact:
        send_email_otp(body.contact, code)
    else:
        # Assuming it's a phone number or we fall back to user's registered phone
        target_phone = body.contact if body.contact.startswith('+') else user.phone
        if target_phone:
            send_sms_otp(target_phone, code)
            
    print(f"\n{'='*50}\n  PASSWORD RESET CODE for {user.username}\n  Code: {code}\n  (Send this to {body.contact})\n{'='*50}\n")
    return {"ok": True, "message": "Verification code sent"}

@app.post("/api/auth/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    from datetime import datetime
    
    users = db.query(models.User).filter(
        (models.User.phone == body.contact) | (models.User.email == body.contact) | (models.User.username == body.contact)
    ).all()
    
    if not users:
        raise HTTPException(404, "No account found")
        
    matched_users = [u for u in users if u.reset_code and u.reset_code == body.code]
        
    if not matched_users:
        raise HTTPException(400, "Invalid verification code")
        
    if matched_users[0].reset_code_expiry and datetime.utcnow() > matched_users[0].reset_code_expiry:
        raise HTTPException(400, "Verification code has expired")
        
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
        
    new_hash = auth_utils.hash_password(body.new_password)
    for u in matched_users:
        u.password_hash = new_hash
        u.reset_code = None
        u.reset_code_expiry = None
    db.commit()
    return {"ok": True, "message": "Password reset successful"}

# ════════════════════════════════════════════════════════════
# SELF-REGISTRATION
# ════════════════════════════════════════════════════════════
@app.post("/api/auth/validate-signup/branch-admin")
def validate_signup_branch_admin(body: SignupSuperAdmin, db: Session = Depends(get_db)):
    """Pre-validate branch-admin signup fields before proceeding to payment."""
    # Cleanup rejected accounts that match these fields
    rej_users = db.query(models.User).filter(((models.User.username == body.username) | (models.User.phone == body.phone)) & (models.User.status == "Rejected")).all()
    for ru in rej_users:
        if ru.branch_id: db.query(models.Branch).filter(models.Branch.id == ru.branch_id).delete()
        db.delete(ru)
    db.commit()

    if body.company_reg_no:
        rej_branches = db.query(models.Branch).filter(models.Branch.company_reg_no == body.company_reg_no).all()
        for rb in rej_branches:
            owner = db.query(models.User).filter(models.User.id == rb.owner_id).first() if rb.owner_id else None
            if not owner or owner.status == "Rejected":
                if owner: db.delete(owner)
                db.delete(rb)
        db.commit()

    if db.query(models.User).filter(models.User.username == body.username).first():
        raise HTTPException(400, "Username already taken")
    if db.query(models.User).filter(models.User.phone == body.phone).first():
        raise HTTPException(400, "Phone number already registered")
    if body.company_reg_no:
        existing = db.query(models.Branch).filter(
            models.Branch.company_reg_no == body.company_reg_no,
            models.Branch.company_reg_no != None,
            models.Branch.company_reg_no != ""
        ).first()
        if existing:
            raise HTTPException(400, "This Company Registration Number is already registered. Please contact support if this is an error.")
    return {"ok": True}

@app.post("/api/auth/signup/branch-admin", status_code=201)
def signup_branch_admin(body: SignupSuperAdmin, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Cleanup rejected accounts that match these fields
    rej_users = db.query(models.User).filter(((models.User.username == body.username) | (models.User.phone == body.phone)) & (models.User.status == "Rejected")).all()
    for ru in rej_users:
        if ru.branch_id: db.query(models.Branch).filter(models.Branch.id == ru.branch_id).delete()
        db.delete(ru)
    db.commit()

    if body.company_reg_no:
        rej_branches = db.query(models.Branch).filter(models.Branch.company_reg_no == body.company_reg_no).all()
        for rb in rej_branches:
            owner = db.query(models.User).filter(models.User.id == rb.owner_id).first() if rb.owner_id else None
            if not owner or owner.status == "Rejected":
                if owner: db.delete(owner)
                db.delete(rb)
        db.commit()

    if db.query(models.User).filter(models.User.username == body.username).first():
        raise HTTPException(400, "Username already taken")
    if db.query(models.User).filter(models.User.phone == body.phone).first():
        raise HTTPException(400, "Phone number already registered")
    if body.company_reg_no:
        existing = db.query(models.Branch).filter(
            models.Branch.company_reg_no == body.company_reg_no,
            models.Branch.company_reg_no != None,
            models.Branch.company_reg_no != ""
        ).first()
        if existing:
            raise HTTPException(400, "This Company Registration Number is already registered")
    import random, string
    bid = "br" + "".join(random.choices(string.digits, k=6))
    
    expiry_date = None
    plan = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == body.subscription).first()
    if plan:
        billing_cycle = "monthly"
        if body.payment and isinstance(body.payment, dict):
            billing_cycle = body.payment.get("billing_cycle", "monthly")
            
        days_to_add = 30
        if billing_cycle == "annually" or billing_cycle == "annual":
            days_to_add = 365
        elif plan.id == "trial":
            days_to_add = 14
        else:
            duration_str = plan.duration.lower()
            if "month" in duration_str:
                num = int("".join(filter(str.isdigit, duration_str)) or 1)
                days_to_add = num * 30
            elif "year" in duration_str:
                num = int("".join(filter(str.isdigit, duration_str)) or 1)
                days_to_add = num * 365
            elif "day" in duration_str:
                num = int("".join(filter(str.isdigit, duration_str)) or 14)
                days_to_add = num
                
        expiry_date = (datetime.now() + timedelta(days=days_to_add)).isoformat()
        try:
            if body.payment and body.payment.get("amount") is not None:
                amt = float(body.payment.get("amount"))
            elif plan:
                bc = body.payment.get("billing_cycle", "monthly")
                curr = body.payment.get("currency", "MYR")
                import re
                if curr == "INR":
                    p_val = plan.annual_price_inr if bc in ("annual", "annually") else plan.monthly_price_inr
                else:
                    p_val = plan.annual_price if bc in ("annual", "annually") else plan.monthly_price
                    
                if isinstance(p_val, str):
                    p_val = re.sub(r'[^\d.]', '', p_val)
                    
                amt = float(p_val) if p_val is not None else 0.0
        except Exception:
            amt = 0.0

    branch = models.Branch(
        id=bid, name=body.branch_name, address=body.branch_address,
        phone=body.branch_phone or body.phone, manager=body.name,
        status="Pending", subscription=body.subscription,
        company_reg_no=body.company_reg_no,
        created_at=datetime.now().strftime("%Y-%m-%d"),
        expiry_date=expiry_date
    )
    db.add(branch)
    initials = "".join(w[0] for w in body.name.split()[:2]).upper() or body.name[:2].upper()
    user = models.User(
        username=body.username, password_hash=auth_utils.hash_password(body.password),
        plain_password=body.password,
        role="SuperAdmin", name=body.name, phone=body.phone,
        status="Pending", avatar=initials, branch_id=bid,
        joined=datetime.now().strftime("%b %Y"),
        tracking_id=body.trackingId, payment_info=body.payment,
        subscription=body.subscription,
    )
    if hasattr(models.User, 'email'): user.email = body.email
    db.add(user)
    db.flush()
    branch.owner_id = user.id
    
    if body.payment and isinstance(body.payment, dict):
        try:
            amt_raw = body.payment.get("amount")
            if amt_raw:
                import re
                amt = float(re.sub(r'[^\d.]', '', str(amt_raw)))
            else:
                bc = body.payment.get("billing_cycle", "monthly")
                curr = body.payment.get("currency", "MYR")
                if curr == "INR":
                    p_val = plan.annual_price_inr if bc in ("annual", "annually") else plan.monthly_price_inr
                else:
                    p_val = plan.annual_price if bc in ("annual", "annually") else plan.monthly_price
                amt = float(p_val) if p_val is not None else 0.0
        except Exception:
            amt = 0.0

        import uuid
        tx_id = body.payment.get("transactionId") or f"pay_{uuid.uuid4().hex[:12]}"
        tx = models.SubscriptionTransaction(
            user_id=user.id,
            user_name=user.name,
            branch_id=bid,
            branch_name=body.branch_name,
            plan_id=plan.id if plan else "unknown",
            plan_name=plan.label if plan else "Unknown Plan",
            amount=amt,
            currency=body.payment.get("currency") or "MYR",
            transaction_id=tx_id,
            payment_date=body.payment.get("paymentDate") or datetime.now().strftime("%d %b %Y, %I:%M %p"),
            status="Pending"
        )
        db.add(tx)
        
    db.commit()
    # Notify SupremeAdmin of new registration via WebSocket (fire-and-forget via background)
    background_tasks.add_task(
        manager.broadcast_event,
        "user.registered",
        {"message": f"New registration from {body.name} ({body.branch_name}) \u2014 pending approval", "name": body.name, "branch": body.branch_name},
        None,
        ["SupremeAdmin"]
    )
    return {"message": "Registration submitted. Awaiting SupremeAdmin approval.", "branch_id": bid}

@app.get("/api/auth/check-status/{tracking_id}")
def check_status(tracking_id: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter((models.User.tracking_id == tracking_id) | (models.User.phone == tracking_id)).first()
    if not user:
        raise HTTPException(404, "Application not found")
    
    plan_name = "Unknown"
    if user.subscription:
        plan = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == user.subscription).first()
        if plan: plan_name = plan.label
        
    branch = db.query(models.Branch).filter(models.Branch.id == user.branch_id).first() if user.branch_id else None
        
    return {
        "name": user.name,
        "status": user.status,
        "plan": plan_name,
        "date": to_iso_utc(user.created_at),
        "username": user.username,
        "phone": user.phone,
        "email": getattr(user, "email", ""),
        "branch_name": branch.name if branch else "",
        "company_reg_no": branch.company_reg_no if branch else "",
        "branch_address": branch.address if branch else "",
        "branch_phone": branch.phone if branch else ""
    }

@app.post("/api/auth/signup/individual", status_code=201)
def signup_individual(body: SignupIndividual, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == body.username).first():
        raise HTTPException(400, "Username already taken")
    initials = "".join(w[0] for w in body.name.split()[:2]).upper() or body.name[:2].upper()
    user = models.User(
        username=body.username, password_hash=auth_utils.hash_password(body.password),
        plain_password=body.password,
        role="IndividualUser", name=body.name, phone=body.phone,
        email=body.email, vehicle_plate=body.vehicle_plate,
        vehicle_make=body.vehicle_make, vehicle_model=body.vehicle_model,
        status="Active", avatar=initials, branch_id=None,
        joined=datetime.now().strftime("%b %Y"),
    )
    db.add(user)
    db.commit(); db.refresh(user)
    access_token = auth_utils.create_token({"sub": user.id, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "user": user_to_dict(user)}


# ════════════════════════════════════════════════════════════
# INDIVIDUAL USER — MY DASHBOARD
# ════════════════════════════════════════════════════════════
@app.get("/api/individual/dashboard")
def individual_dashboard(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "IndividualUser":
        raise HTTPException(403, "IndividualUser only")
    all_sessions = db.query(models.Session).order_by(models.Session.created_at.desc()).all()
    import re
    def norm(p):
        if not p: return ""
        n = re.sub(r'\D', '', p)
        if n.startswith('60'): n = n[2:]
        elif n.startswith('91'): n = n[2:]
        elif n.startswith('0'): n = n[1:]
        return n

    norm_phone = norm(current_user.phone)
    my_sessions = []
    for s in all_sessions:
        cust = s.customer or {}
        if isinstance(cust, str):
            import json as _json
            try: cust = _json.loads(cust)
            except: cust = {}
        s_phone = norm(cust.get("phone"))
        if s_phone and s_phone == norm_phone:
            my_sessions.append(session_to_dict(s))

    all_pending = db.query(models.PendingJob).order_by(models.PendingJob.submitted_at.desc()).all()
    active_jobs = []
    for j in all_pending:
        cust = j.customer or {}
        if isinstance(cust, str):
            import json as _json
            try: cust = _json.loads(cust)
            except: cust = {}
        j_phone = norm(cust.get("phone"))
        if j_phone and j_phone == norm_phone:
            active_jobs.append(job_to_dict(j))

    customer = db.query(models.Customer).filter(
        (models.Customer.phone == current_user.phone) |
        (models.Customer.phone == f"0{norm_phone}") |
        (models.Customer.phone == f"60{norm_phone}") |
        (models.Customer.phone == f"+60{norm_phone}") |
        (models.Customer.phone == f"91{norm_phone}") |
        (models.Customer.phone == f"+91{norm_phone}") |
        (models.Customer.phone == norm_phone)
    ).first()
    loyalty_setting = db.query(models.Setting).filter(models.Setting.key == "loyalty").first()
    loyalty_cfg = {}
    if loyalty_setting:
        import json as _json
        try: loyalty_cfg = _json.loads(loyalty_setting.value)
        except: pass
    visits = customer.visits if customer else []
    coupons = customer.coupon_history if customer else []
    return {
        "active_jobs": active_jobs,
        "sessions": my_sessions,
        "total_washes": len(my_sessions),
        "total_spend": sum(s.get("total", 0) for s in my_sessions),
        "customer": {
            "id": customer.id if customer else None,
            "name": current_user.name,
            "phone": current_user.phone,
            "visits": visits,
            "coupon_history": coupons,
            "coupons_redeemed": customer.coupons_redeemed if customer else 0,
        },
        "loyalty_cfg": loyalty_cfg,
    }


# ════════════════════════════════════════════════════════════
# SUPREME ADMIN — PENDING APPROVALS
# ════════════════════════════════════════════════════════════
@app.get("/api/admin/pending-approvals")
def list_pending(db: Session = Depends(get_db), _=Depends(require_super_admin)):
    users = db.query(models.User).filter(models.User.status == "Pending", models.User.role == "SuperAdmin").all()
    result = []
    supreme_payments = db.query(models.Payment).filter(models.Payment.owner_id == "SUPREME").order_by(models.Payment.created_at.desc()).all()
    for u in users:
        branch = db.query(models.Branch).filter(models.Branch.id == u.branch_id).first() if u.branch_id else None
        
        payment_info = None
        payment = next((p for p in supreme_payments if p.meta_data and str(p.meta_data.get("user_id")) == str(u.id)), None)
        if payment:
            payment_info = {"status": payment.status, "amount": payment.amount, "qr_id": payment.qr_id}
            
        result.append({**user_to_dict(u), "branch": {"id": branch.id, "name": branch.name, "address": branch.address, "subscription": getattr(branch, "subscription", "trial")} if branch else None, "payment": payment_info})
    return result

@app.put("/api/admin/approve/{user_id}")
def approve_super_admin(user_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(require_super_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(404, "User not found")
    
    # If the user is pending, make them active
    if user.status == "Pending":
        user.status = "Active"
        
    plan_id = user.subscription
    billing_cycle = "monthly"
    
    # Check if this is a pending upgrade
    if user.tracking_id and user.tracking_id.startswith("UPGRADE-"):
        parts = user.tracking_id.split("-")
        if len(parts) >= 3:
            plan_id = parts[1]
            billing_cycle = parts[2]
            user.subscription = plan_id
        # Clear the upgrade tracking flag
        user.tracking_id = None
    elif user.payment_info and "pendingPlanId" in user.payment_info:
        plan_id = user.payment_info["pendingPlanId"]
        billing_cycle = user.payment_info.get("billing_cycle", "monthly")
        user.subscription = plan_id
    elif user.payment_info and "billing_cycle" in user.payment_info:
        billing_cycle = user.payment_info.get("billing_cycle", "monthly")
        
    plan = None
    if plan_id:
        plan = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == plan_id).first()
        
    branch = None
    if user.branch_id:
        branch = db.query(models.Branch).filter(models.Branch.id == user.branch_id).first()
        if branch:
            branch.status = "Active"
            branch.subscription = plan_id
            if plan:
                # Use standard 30 days for monthly or 365 for annual
                days = 365 if billing_cycle in ("annual", "annually") else 30
                # Start from today since it's an immediate upgrade upon approval
                exp_date = datetime.now() + timedelta(days=days)
                branch.expiry_date = exp_date.strftime("%Y-%m-%d")
        
    if user.payment_info and plan:
        currency_val = user.payment_info.get("currency", "MYR") if user.payment_info else "MYR"
        try:
            if user.payment_info and user.payment_info.get("amount") is not None:
                amt = float(user.payment_info.get("amount"))
            else:
                import re
                if currency_val == "INR":
                    price_val = plan.annual_price_inr if billing_cycle in ("annual", "annually") else plan.monthly_price_inr
                else:
                    price_val = plan.annual_price if billing_cycle in ("annual", "annually") else plan.monthly_price
                
                # Ensure price_val is numeric by removing currency symbols and commas
                if isinstance(price_val, str):
                    price_val = re.sub(r'[^\d.]', '', price_val)
                    
                amt = float(price_val) if price_val else 0.0
        except:
            amt = 0.0

        tx = db.query(models.SubscriptionTransaction).filter(
            models.SubscriptionTransaction.transaction_id == user.payment_info.get("transactionId"),
            models.SubscriptionTransaction.user_id == user.id
        ).first()
        
        if tx:
            tx.status = "Verified"
        else:
            tx = models.SubscriptionTransaction(
                user_id=user.id,
                user_name=user.name,
                branch_id=branch.id if branch else None,
                branch_name=branch.name if branch else None,
                plan_id=plan.id,
                plan_name=plan.label,
                amount=amt,
                currency=currency_val,
                transaction_id=user.payment_info.get("transactionId"),
                payment_date=user.payment_info.get("paymentDate"),
                status="Verified"
            )
            db.add(tx)
        
        # Clean up pending payment info to prevent double processing
        if "pendingPlanId" in user.payment_info:
            cleaned_info = {k:v for k,v in user.payment_info.items() if k not in ["pendingPlanId", "billing_cycle", "requestedAt"]}
            user.payment_info = cleaned_info
            
    db.commit()
    background_tasks.add_task(
        manager.broadcast_event,
        "plan.upgraded",
        {"message": f"{user.name}'s account has been approved and upgraded!", "userId": user.id},
        None,
        ["SupremeAdmin", "SuperAdmin", "Admin"]
    )
    return {"message": f"{user.name} approved and upgraded successfully"}

@app.put("/api/admin/reject/{user_id}")
def reject_super_admin(user_id: int, db: Session = Depends(get_db), _=Depends(require_super_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(404, "User not found")
    user.status = "Rejected"
    if user.branch_id:
        branch = db.query(models.Branch).filter(models.Branch.id == user.branch_id).first()
        if branch: branch.status = "Inactive"
    db.commit()
    return {"message": f"{user.name} rejected"}


# ════════════════════════════════════════════════════════════
# USERS
# ════════════════════════════════════════════════════════════
@app.get("/api/users")
def list_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    q = db.query(models.User)
    if current_user.role == "SupremeAdmin":
        pass
    elif current_user.role in ("SuperAdmin", "Admin", "Washer"):
        from sqlalchemy import or_
        q = q.filter(
            or_(
                models.User.branch_id.in_(get_owned_branch_ids(db, current_user)),
                models.User.role == "IndividualUser"
            ),
            models.User.role != "SupremeAdmin"
        )
    return annotate_users_with_locks(db, q.all())

@app.post("/api/users", status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    if db.query(models.User).filter(models.User.username == body.username).first():
        raise HTTPException(400, "Username already exists")
    if current_user.role in ("SuperAdmin", "Admin"):
        if body.role not in ("Washer", "Admin"):
            raise HTTPException(403, "Branch Admin can only create Washer or Admin accounts")
        owned_ids = get_owned_branch_ids(db, current_user)
        if body.branch_id not in owned_ids:
            body.branch_id = owned_ids[0] if owned_ids else None
    
    if body.role == "Washer" and body.branch_id:
        plan = db.query(models.SubscriptionPlan).join(models.Branch, models.Branch.subscription == models.SubscriptionPlan.id).filter(models.Branch.id == body.branch_id).first()
        if plan and plan.max_washers is not None and plan.max_washers > 0:
            count = db.query(models.User).filter(models.User.branch_id == body.branch_id, models.User.role == "Washer").count()
            if count >= plan.max_washers:
                raise HTTPException(400, "Washer limit reached for this branch. Please upgrade your plan to add more washers.")
    initials = "".join(w[0] for w in body.name.split() if w).upper()[:2]
    user = models.User(
        username=body.username, password_hash=auth_utils.hash_password(body.password),
        plain_password=body.password,
        role=body.role, name=body.name, phone=body.phone,
        branch_id=body.branch_id,
        status="Active", avatar=initials, joined=datetime.now().strftime("%b %Y"),
    )
    db.add(user); db.commit(); db.refresh(user)
    if user.role == "SuperAdmin" and user.branch_id:
        branch = db.query(models.Branch).filter(models.Branch.id == user.branch_id).first()
        if branch and not branch.owner_id:
            branch.owner_id = user.id
            db.commit()
    return user_to_dict(user)

@app.put("/api/users/{user_id}")
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(404, "User not found")
    if user.role == "SupremeAdmin" and current_user.id != user.id:
        raise HTTPException(403, "Cannot modify Supreme Admin")
    if current_user.role in ("SuperAdmin", "Admin") and user.branch_id not in get_owned_branch_ids(db, current_user):
        raise HTTPException(403, "Cannot modify users outside your branch")
    if body.name      is not None: user.name      = body.name
    if body.username  is not None: user.username  = body.username
    if body.phone     is not None: user.phone     = body.phone
    if body.email     is not None: user.email     = body.email
    if body.status    is not None: user.status    = body.status
    if body.subscription is not None: user.subscription = body.subscription
    if body.branch_id is not None and current_user.role == "SupremeAdmin":
        user.branch_id = body.branch_id
        if user.role == "SuperAdmin":
            branch = db.query(models.Branch).filter(models.Branch.id == body.branch_id).first()
            if branch and not branch.owner_id:
                branch.owner_id = user.id
    if body.password  is not None:
        user.password_hash = auth_utils.hash_password(body.password)
        user.plain_password = body.password

    # Sync branch phone if this user is the branch Admin
    if body.phone is not None and user.role == "Admin" and user.branch_id:
        branch = db.query(models.Branch).filter(models.Branch.id == user.branch_id).first()
        if branch:
            branch.phone = body.phone

    db.commit(); db.refresh(user)
    return user_to_dict(user)

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user: raise HTTPException(404, "User not found")
    if user.role == "SupremeAdmin": raise HTTPException(400, "Cannot delete Supreme Admin")
    if user.role == "SuperAdmin" and current_user.role != "SupremeAdmin":
        raise HTTPException(400, "Cannot delete Super Admin")
    if current_user.role in ("SuperAdmin", "Admin") and user.branch_id not in get_owned_branch_ids(db, current_user):
        raise HTTPException(403, "Cannot delete users outside your branch")
    db.delete(user); db.commit()
    return {"ok": True}


# ════════════════════════════════════════════════════════════
# BRANCHES
# ════════════════════════════════════════════════════════════
@app.get("/api/branches")
def list_branches(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    q = db.query(models.Branch)
    if current_user.role in ("SuperAdmin", "Admin"):
        q = q.filter(models.Branch.id.in_(get_owned_branch_ids(db, current_user)))
    elif current_user.role == "Washer":
        q = q.filter(models.Branch.id == current_user.branch_id)
    branches = q.all()
    from sqlalchemy import extract
    now = datetime.now()
    
    locked_branch_ids = get_locked_branch_ids(db)
    
    result = []
    owner_expiry_cache = {}
    
    for b in branches:
        owner_id = getattr(b, "owner_id", None)
        if owner_id:
            if owner_id not in owner_expiry_cache:
                owner = db.query(models.User).filter(models.User.id == owner_id).first()
                if owner and owner.branch_id:
                    owner_primary_branch = db.query(models.Branch).filter(models.Branch.id == owner.branch_id).first()
                    if owner_primary_branch and owner_primary_branch.expiry_date:
                        owner_expiry_cache[owner_id] = owner_primary_branch.expiry_date
                    else:
                        owner_expiry_cache[owner_id] = None
                else:
                    owner_expiry_cache[owner_id] = None
            
            if owner_expiry_cache[owner_id]:
                b.expiry_date = owner_expiry_cache[owner_id]
                
        count = db.query(models.Session).filter(
            models.Session.branch_id == b.id,
            extract('year', models.Session.created_at) == now.year,
            extract('month', models.Session.created_at) == now.month
        ).count()
        setattr(b, "current_month_sessions", count)
        
        plan_id = b.subscription or "trial"
        plan = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == plan_id).first()
        setattr(b, "max_sessions", plan.max_sessions if plan else 0)
        setattr(b, "max_washers", plan.max_washers if plan else None)
        
        d = branch_to_dict(b)
        d["is_locked"] = b.id in locked_branch_ids
        result.append(d)
    return result

@app.post("/api/branches", status_code=201)
def create_branch(body: BranchIn, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    if current_user.role == "SuperAdmin":
        owned_count = db.query(models.Branch).filter(models.Branch.owner_id == current_user.id).count()
        if current_user.subscription:
            plan = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == current_user.subscription).first()
            if plan and plan.max_branches > 0 and owned_count >= plan.max_branches:
                raise HTTPException(403, f"Branch limit reached. Your current plan allows a maximum of {plan.max_branches} branch(es). Please upgrade your plan to add more.")

    bid = body.id or f"br{int(datetime.now().timestamp())}"
    owner_id = current_user.id if current_user.role == "SuperAdmin" else None
    
    # SupremeAdmin might specify an owner_id in the body (if supported), but we'll stick to current logic
    b = models.Branch(id=bid, name=body.name, address=body.address, owner_id=owner_id,
                      phone=body.phone, manager=body.manager, status=body.status,
                      subscription=body.subscription,
                      created_at=datetime.now().strftime("%Y-%m-%d"))
    db.add(b); db.commit(); db.refresh(b)
    return branch_to_dict(b)

@app.put("/api/branches/{bid}")
def update_branch(bid: str, body: BranchUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    b = db.query(models.Branch).filter(models.Branch.id == bid).first()
    if not b: raise HTTPException(404, "Branch not found")
    if body.name is not None: b.name = body.name
    if body.address is not None: b.address = body.address
    if body.phone is not None: b.phone = body.phone
    if body.manager is not None: b.manager = body.manager
    if body.status is not None: b.status = body.status
    if hasattr(body, 'subscription') and body.subscription:
        if current_user.role == "SupremeAdmin":
            b.subscription = body.subscription
            if not hasattr(body, 'expiry_date') or body.expiry_date is None:
                plan = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == body.subscription).first()
                if plan and plan.duration:
                    calc_exp = calculate_expiry_date(plan.duration)
                    if calc_exp: b.expiry_date = calc_exp
    if hasattr(body, 'expiry_date') and body.expiry_date is not None:
        if current_user.role == "SupremeAdmin":
            b.expiry_date = body.expiry_date
            
    if body.phone is not None:
        admin_user = db.query(models.User).filter(models.User.branch_id == bid, models.User.role == "Admin").first()
        if admin_user:
            admin_user.phone = body.phone
            
    db.commit(); db.refresh(b)
    return branch_to_dict(b)

@app.delete("/api/branches/{bid}")
def delete_branch(bid: str, db: Session = Depends(get_db), _=Depends(require_admin_or_super_admin)):
    b = db.query(models.Branch).filter(models.Branch.id == bid).first()
    if not b: raise HTTPException(404, "Branch not found")
    
    # Delete associated users (like Branch Admins and Washers)
    associated_users = db.query(models.User).filter(models.User.branch_id == bid).all()
    for u in associated_users:
        db.delete(u)
        
    db.delete(b)
    db.commit()
    return {"ok": True, "deleted_users": len(associated_users)}


# ════════════════════════════════════════════════════════════
# PACKAGES
# ════════════════════════════════════════════════════════════
@app.get("/api/packages")
def list_packages(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    q = db.query(models.Package)
    if current_user.role in ("SuperAdmin", "Admin", "Washer"):
        owned_ids = get_owned_branch_ids(db, current_user)
        if owned_ids:
            q = q.filter((models.Package.branch_id.in_(owned_ids)) | (models.Package.branch_id == None))
    return [pkg_to_dict(p) for p in q.order_by(models.Package.sort_order).all()]

@app.post("/api/packages", status_code=201)
def create_package(body: PackageIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    pid = body.id or f"pkg_{int(datetime.now().timestamp())}"
    branch_id = body.branch_id
    if current_user.role in ("SuperAdmin", "Admin"):
        owned_ids = get_owned_branch_ids(db, current_user)
        branch_id = body.branch_id if body.branch_id in owned_ids else (owned_ids[0] if owned_ids else None)
    
    p = models.Package(id=pid, name=body.name, desc=body.desc, price=body.price, time=body.time, color=body.color, sort_order=body.sort_order, products=body.products, branch_id=branch_id)
    db.add(p); db.commit(); db.refresh(p)
    pkg_dict = pkg_to_dict(p)
    background_tasks.add_task(manager.broadcast_event, "package.created", {"package": pkg_dict}, branch_id)
    return pkg_dict

@app.put("/api/packages/{pid}")
def update_package(pid: str, body: PackageIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    p = db.query(models.Package).filter(models.Package.id == pid).first()
    if not p: raise HTTPException(404, "Package not found")
    if current_user.role in ("SuperAdmin", "Admin") and p.branch_id and p.branch_id not in get_owned_branch_ids(db, current_user):
        raise HTTPException(403, "Cannot modify packages outside your branch")
    
    p.name=body.name; p.desc=body.desc; p.price=body.price; p.time=body.time; p.color=body.color; p.products=body.products
    if current_user.role == "SupremeAdmin" and hasattr(body, "branch_id"):
        p.branch_id = body.branch_id
    db.commit(); db.refresh(p)
    pkg_dict = pkg_to_dict(p)
    background_tasks.add_task(manager.broadcast_event, "package.updated", {"package": pkg_dict}, p.branch_id)
    return pkg_dict

@app.delete("/api/packages/{pid}")
def delete_package(pid: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    p = db.query(models.Package).filter(models.Package.id == pid).first()
    if not p: raise HTTPException(404, "Package not found")
    if current_user.role in ("SuperAdmin", "Admin") and p.branch_id and p.branch_id not in get_owned_branch_ids(db, current_user):
        raise HTTPException(403, "Cannot delete packages outside your branch")
        
    branch_id = p.branch_id
    db.delete(p); db.commit()
    background_tasks.add_task(manager.broadcast_event, "package.deleted", {"packageId": pid}, branch_id)
    return {"ok": True}


# ════════════════════════════════════════════════════════════
# SUBSCRIPTION PLANS
# ════════════════════════════════════════════════════════════
@app.get("/api/subscriptions")
def list_subscriptions(db: Session = Depends(get_db)):
    return [subplan_to_dict(sp) for sp in db.query(models.SubscriptionPlan).order_by(models.SubscriptionPlan.monthly_price.asc()).all()]

@app.post("/api/subscriptions", status_code=201)
def create_subscription(body: SubscriptionPlanIn, db: Session = Depends(get_db), _=Depends(require_super_admin)):
    pid = body.id or f"sub_{int(datetime.now().timestamp())}"
    sp = models.SubscriptionPlan(
        id=pid, label=body.label, price=body.price, duration=body.duration,
        monthly_price=body.monthly_price, annual_price=body.annual_price,
        price_inr=body.price_inr, monthly_price_inr=body.monthly_price_inr, annual_price_inr=body.annual_price_inr,
        color=body.color, features=body.features, max_washers=body.max_washers,
        max_sessions=body.max_sessions, max_branches=body.max_branches, has_loyalty=body.has_loyalty,
        has_reports=body.has_reports, report_access=body.report_access, has_ai_scanning=body.has_ai_scanning,
        has_multiple_branches=body.has_multiple_branches, has_payment_gateway=body.has_payment_gateway
    )
    db.add(sp); db.commit(); db.refresh(sp)
    return subplan_to_dict(sp)

@app.put("/api/subscriptions/{pid}")
def update_subscription(pid: str, body: SubscriptionPlanIn, db: Session = Depends(get_db), _=Depends(require_super_admin)):
    sp = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == pid).first()
    if not sp: raise HTTPException(404, "Subscription Plan not found")
    sp.label=body.label; sp.price=body.price; sp.duration=body.duration; sp.color=body.color; sp.features=body.features
    sp.monthly_price=body.monthly_price; sp.annual_price=body.annual_price; sp.max_branches=body.max_branches
    sp.price_inr=body.price_inr; sp.monthly_price_inr=body.monthly_price_inr; sp.annual_price_inr=body.annual_price_inr
    sp.max_washers=body.max_washers; sp.max_sessions=body.max_sessions
    sp.has_loyalty=body.has_loyalty; sp.has_reports=body.has_reports; sp.report_access=body.report_access
    sp.has_ai_scanning=body.has_ai_scanning
    sp.has_multiple_branches=body.has_multiple_branches
    sp.has_payment_gateway=body.has_payment_gateway
    db.commit(); db.refresh(sp)
    return subplan_to_dict(sp)

@app.delete("/api/subscriptions/{pid}")
def delete_subscription(pid: str, db: Session = Depends(get_db), _=Depends(require_super_admin)):
    sp = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == pid).first()
    if not sp: raise HTTPException(404, "Subscription Plan not found")
    db.delete(sp); db.commit()
    return {"ok": True}

@app.get("/api/subscriptions/history")
def subscription_history(all: bool = False, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.SubscriptionTransaction)
    role_lower = (current_user.role or "").lower()
    
    # If the user asks for all AND they are a supreme/super admin, show all transactions (for the global dashboard)
    if all and role_lower in ["superadmin", "supremeadmin", "super_admin"]:
        pass # do not filter by user_id
    else:
        # Default behavior: ONLY show the user's own transactions (used in My Plan page)
        query = query.filter(models.SubscriptionTransaction.user_id == current_user.id)
        
    txs = query.order_by(models.SubscriptionTransaction.created_at.desc()).all()
    
    res = [{
        "id": tx.id,
        "user_id": tx.user_id,
        "user_name": tx.user_name,
        "branch_id": tx.branch_id,
        "branch_name": tx.branch_name,
        "plan_id": tx.plan_id,
        "plan_name": tx.plan_name,
        "amount": tx.amount,
        "currency": tx.currency,
        "transaction_id": tx.transaction_id,
        "payment_date": tx.payment_date,
        "status": tx.status,
        "created_at": tx.created_at.isoformat() + "Z" if tx.created_at else None
    } for tx in txs]



    return res

class UpgradeRequest(BaseModel):
    userId: int
    branchId: Optional[str] = None
    newPlanId: str
    billing_cycle: str = "monthly"
    payment: dict

@app.post("/api/subscriptions/upgrade")
def upgrade_subscription(req: UpgradeRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == req.userId).first()
    if not user: raise HTTPException(404, "User not found")

    # Store the pending upgrade info WITHOUT locking the account.
    # The user stays Active and continues using their current plan until
    # the SupremeAdmin approves — at which point the new plan is applied.
    user.payment_info = {
        "transactionId": req.payment.get("transactionId"),
        "accountName": req.payment.get("accountName"),
        "paymentDate": req.payment.get("paymentDate"),
        "pendingPlanId": req.newPlanId,
        "billing_cycle": req.billing_cycle,
        "currency": req.payment.get("currency", "MYR"),
        "amount": req.payment.get("amount"),
        "requestedAt": datetime.utcnow().isoformat() + "Z",
    }
    # Mark as pending upgrade (NOT suspending — we use a separate flag via tracking_id)
    user.tracking_id = f"UPGRADE-{req.newPlanId}-{req.billing_cycle}"
    
    plan = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == req.newPlanId).first()
    plan_name = plan.label if plan else req.newPlanId
    
    amount = 0.0
    if req.payment and req.payment.get("amount") is not None:
        amount = float(req.payment.get("amount"))
    elif plan:
        import re
        bc = req.billing_cycle
        currency_val = req.payment.get("currency", "MYR") if req.payment else "MYR"
        if currency_val == "INR":
            price_val = plan.annual_price_inr if bc in ("annual", "annually") else plan.monthly_price_inr
        else:
            price_val = plan.annual_price if bc in ("annual", "annually") else plan.monthly_price
            
        if isinstance(price_val, str):
            price_val = re.sub(r'[^\d.]', '', price_val)
            
        try:
            amount = float(price_val) if price_val else 0.0
        except:
            amount = 0.0

    branch = db.query(models.Branch).filter(models.Branch.id == user.branch_id).first()

    tx = models.SubscriptionTransaction(
        user_id=user.id,
        user_name=user.name or user.username,
        branch_id=branch.id if branch else None,
        branch_name=branch.name if branch else None,
        plan_id=req.newPlanId,
        plan_name=plan_name,
        amount=amount,
        currency=req.payment.get("currency", "MYR"),
        transaction_id=req.payment.get("transactionId"),
        payment_date=req.payment.get("paymentDate"),
        status="Verified" if str(req.payment.get("transactionId", "")).startswith("pay_") else "Pending Approval"
    )
    db.add(tx)

    # Do NOT touch user.status or user.subscription — user keeps current plan & access
    db.commit()
    background_tasks.add_task(
        manager.broadcast_event,
        "plan.upgrade_requested",
        {"message": f"Plan upgrade request from user #{req.userId} \u2014 pending approval", "userId": req.userId, "newPlanId": req.newPlanId},
        None,
        ["SupremeAdmin"]
    )
    return {"message": "Upgrade request submitted. You can continue using your account until the plan is activated."}


# ════════════════════════════════════════════════════════════
# PRODUCTS
# ════════════════════════════════════════════════════════════
@app.get("/api/products")
def list_products(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    q = db.query(models.Product)
    if current_user.role in ("SuperAdmin", "Admin", "Washer"):
        q = q.filter(models.Product.branch_id.in_(get_owned_branch_ids(db, current_user)))
    return [prod_to_dict(p) for p in q.order_by(models.Product.created_at.desc()).all()]

@app.post("/api/products", status_code=201)
def create_product(body: ProductIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    pid = body.id or f"prod_{int(datetime.now().timestamp())}"
    branch_id = body.branch_id
    if current_user.role in ("SuperAdmin", "Admin"):
        owned_ids = get_owned_branch_ids(db, current_user)
        branch_id = body.branch_id if body.branch_id in owned_ids else (owned_ids[0] if owned_ids else None)
    clicks = body.clicks if body.clicks is not None else body.qty_per_unit
    p = models.Product(id=pid, name=body.name, desc=body.desc, size=body.size,
                       price=body.price, unit_cost=body.unit_cost, 
                       qty_per_unit=body.qty_per_unit, clicks=clicks,
                       barcode=body.barcode, branch_id=branch_id)
    db.add(p); db.commit(); db.refresh(p)
    background_tasks.add_task(manager.broadcast_event, "product.created", {"product": prod_to_dict(p), "message": f"New product '{p.name}' added"}, branch_id)
    return prod_to_dict(p)

@app.put("/api/products/{pid}")
def update_product(pid: str, body: ProductIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    p = db.query(models.Product).filter(models.Product.id == pid).first()
    if not p: raise HTTPException(404, "Product not found")
    if current_user.role in ("SuperAdmin", "Admin") and p.branch_id not in get_owned_branch_ids(db, current_user):
        raise HTTPException(403, "Cannot modify products outside your branch")
    p.name=body.name; p.desc=body.desc; p.price=body.price; p.unit_cost=body.unit_cost; p.size=body.size; p.qty_per_unit=body.qty_per_unit
    if body.clicks is not None: p.clicks = body.clicks
    p.barcode=body.barcode
    if current_user.role == "SupremeAdmin" and hasattr(body, "branch_id"):
        p.branch_id = body.branch_id
    db.commit(); db.refresh(p)
    background_tasks.add_task(manager.broadcast_event, "product.updated", {"product": prod_to_dict(p), "message": f"Product '{p.name}' updated"}, p.branch_id)
    return prod_to_dict(p)

@app.delete("/api/products/{pid}")
def delete_product(pid: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    p = db.query(models.Product).filter(models.Product.id == pid).first()
    if not p: raise HTTPException(404, "Product not found")
    if current_user.role in ("SuperAdmin", "Admin") and p.branch_id not in get_owned_branch_ids(db, current_user):
        raise HTTPException(403, "Cannot delete products outside your branch")
    branch_id = p.branch_id
    db.delete(p); db.commit()
    background_tasks.add_task(manager.broadcast_event, "product.deleted", {"productId": pid}, branch_id)
    return {"ok": True}


# ════════════════════════════════════════════════════════════
# SESSIONS
# ════════════════════════════════════════════════════════════
def check_branch_limits(db, branch_id: str):
    if not branch_id: return
    branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if not branch: return
    
    # 1. Check Expiry Date
    if getattr(branch, 'expiry_date'):
        try:
            exp = datetime.strptime(branch.expiry_date, "%Y-%m-%d").date()
            if datetime.now().date() > exp:
                raise HTTPException(403, "Subscription Expired: Please contact your SuperAdmin to upgrade the plan.")
        except ValueError:
            pass

    # 2. Check Session Limit
    plan_id = branch.subscription or "trial"
    plan = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == plan_id).first()
    if plan and plan.max_sessions and plan.max_sessions > 0:
        from sqlalchemy import extract
        now = datetime.now()
        
        # Session limits are on a per calendar month basis, regardless of billing cycle
        session_count = db.query(models.Session).filter(
            models.Session.branch_id == branch_id,
            extract('year', models.Session.created_at) == now.year,
            extract('month', models.Session.created_at) == now.month
        ).count()

        if session_count >= plan.max_sessions:
            raise HTTPException(403, f"Session Limit Reached ({plan.max_sessions}): Please upgrade your subscription plan.")

@app.get("/api/sessions")
def list_sessions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    q = db.query(models.Session).order_by(models.Session.created_at.desc())
    if current_user.role in ("SuperAdmin", "Admin"):
        q = q.filter(models.Session.branch_id.in_(get_owned_branch_ids(db, current_user)))
    return [session_to_dict(s) for s in q.all()]

@app.post("/api/sessions", status_code=201)
def create_session(body: SessionIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "Washer" and is_washer_locked(db, current_user):
        raise HTTPException(403, "Your account is currently locked due to your branch's subscription limits.")
    
    inv_id = next_invoice_number(db)
    
    branch_id = body.branch_id
    branch_name = body.branch
    if not branch_id:
        washer_user = db.query(models.User).filter(models.User.id == body.washer_id).first()
        if washer_user and washer_user.branch_id:
            branch_id = washer_user.branch_id
            branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
            if branch: branch_name = branch.name

    # Enforce Limits
    check_branch_limits(db, branch_id)

    # 1. Deduct all products (Retail, Addon, and Package consumables)
    # The frontend already resolves package consumables to the correct branch inventory items
    # and includes them in body.products with isIncluded=True
    if body.products:
        for p in body.products:
            item_id = p.get('id')
            item = db.query(models.InventoryItem).filter(models.InventoryItem.id == item_id).first()
            if item:
                qty = int(float(p.get('quantity', 1)))
                is_included = p.get('isIncluded', False)
                
                # Directly deduct from quantity
                item.quantity = max(0.0, float(getattr(item, 'quantity', 0.0) or 0.0) - float(qty))
                item.updated_at = datetime.utcnow()
                
                event_type = "wash_usage" if is_included else "retail_sale"
                db.add(models.InventoryHistory(
                    item_id=item_id, event_type=event_type, quantity_change=-float(qty),
                    created_by=body.washer or "System", created_at=datetime.utcnow()
                ))
            else:
                prod = db.query(models.Product).filter(models.Product.id == item_id).first()
                if prod:
                    qty = int(float(p.get('quantity', 1)))
                    prod.clicks = max(0, (prod.clicks or 0) - qty)
                    prod.qty_per_unit = prod.clicks
    s = models.Session(
        id=inv_id, date=body.date, washer_id=body.washer_id, washer=body.washer,
        washer_username=body.washer_username, branch_id=branch_id, branch=branch_name,
        location=body.location, location_name=body.location_name, lat=body.lat, lng=body.lng,
        vehicle=body.vehicle, customer=body.customer, package=body.package,
        payment=body.payment, coupon=body.coupon, products=body.products,
        original_total=body.original_total, total=body.total, status=body.status,
    )
    db.add(s)
    _upsert_customer(db, s)
    db.commit(); db.refresh(s)
    sess_dict = session_to_dict(s)
    background_tasks.add_task(
        manager.broadcast_event,
        "session.created",
        {"session": sess_dict, "message": f"New wash completed by {body.washer}"},
        branch_id
    )
    return sess_dict


# ════════════════════════════════════════════════════════════
# PENDING JOBS
# ════════════════════════════════════════════════════════════
@app.get("/api/pending-jobs")
def list_pending_jobs(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    q = db.query(models.PendingJob).order_by(models.PendingJob.submitted_at.desc())
    if current_user.role in ("SuperAdmin", "Admin", "Washer"):
        q = q.filter(models.PendingJob.branch_id.in_(get_owned_branch_ids(db, current_user)))
    return [job_to_dict(j) for j in q.all()]

@app.post("/api/pending-jobs", status_code=201)
def create_pending_job(body: PendingJobIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "Washer" and is_washer_locked(db, current_user):
        raise HTTPException(403, "Your account is currently locked due to your branch's subscription limits.")
        
    branch_id = body.branch_id
    branch_name = body.branch
    if not branch_id:
        washer_user = db.query(models.User).filter(models.User.id == body.washer_id).first()
        if washer_user and washer_user.branch_id:
            branch_id = washer_user.branch_id
            branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
            if branch: branch_name = branch.name

    # Enforce Limits
    check_branch_limits(db, branch_id)

    j = models.PendingJob(
        id=body.id, customer=body.customer, vehicle=body.vehicle, package=body.package,
        geo=body.geo, location_name=body.location_name,
        branch_id=branch_id, branch=branch_name,
        washer_id=body.washer_id, washer=body.washer, loyalty=body.loyalty,
        status=body.status or "pending",
        products=body.products,
    )
    db.add(j); db.commit(); db.refresh(j)
    job_dict = job_to_dict(j)
    cust_name = (body.customer or {}).get("name", "Customer") if isinstance(body.customer, dict) else "Customer"
    background_tasks.add_task(
        manager.broadcast_event,
        "job.assigned",
        {"job": job_dict, "message": f"New job assigned to {body.washer} for {cust_name}"},
        branch_id
    )
    return job_dict

@app.put("/api/pending-jobs/{job_id}")
def update_pending_job(job_id: str, body: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(get_current_user)):
    j = db.query(models.PendingJob).filter(models.PendingJob.id == job_id).first()
    if not j: raise HTTPException(404, "Job not found")
    for field in ["customer", "vehicle", "package", "geo", "location_name", "branch_id", "branch", "washer_id", "washer", "loyalty", "status", "products"]:
        if field in body: 
            setattr(j, field, body[field])
        elif field == "location_name" and "locationName" in body:
            setattr(j, "location_name", body["locationName"])
        elif field == "branch_id" and "branchId" in body:
            setattr(j, "branch_id", body["branchId"])
        elif field == "washer_id" and "washerId" in body:
            setattr(j, "washer_id", body["washerId"])
    db.commit(); db.refresh(j)
    job_dict = job_to_dict(j)
    background_tasks.add_task(
        manager.broadcast_event,
        "job.updated",
        {"job": job_dict, "message": f"Job {job_id} updated"},
        j.branch_id
    )
    return job_dict

@app.delete("/api/pending-jobs/{job_id}")
def delete_pending_job(job_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(get_current_user)):
    j = db.query(models.PendingJob).filter(models.PendingJob.id == job_id).first()
    if not j: raise HTTPException(404, "Job not found")
    branch_id = j.branch_id
    db.delete(j)
    
    req = db.query(models.CustomerJobRequest).filter(models.CustomerJobRequest.assigned_job_id == job_id).first()
    if req:
        req.status = "Completed"
        
    db.commit()
    background_tasks.add_task(
        manager.broadcast_event,
        "job.completed",
        {"jobId": job_id, "message": "A wash job has been completed!"},
        branch_id
    )
    if req:
        background_tasks.add_task(
            manager.broadcast_event,
            "jobrequest.updated",
            {"request": {"id": req.id, "trackingId": req.tracking_id, "status": req.status}},
            branch_id
        )
    return {"ok": True}


# ════════════════════════════════════════════════════════════
# CUSTOMERS
# ════════════════════════════════════════════════════════════
@app.get("/api/customers")
def list_customers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    q = db.query(models.Customer)
    if current_user.role in ("SuperAdmin", "Admin"):
        q = q.filter(models.Customer.branch_id.in_(get_owned_branch_ids(db, current_user)))
    return [cust_to_dict(c) for c in q.all()]

@app.put("/api/customers/{cid}")
def update_customer(cid: str, body: CustomerUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(models.Customer).filter(models.Customer.id == cid).first()
    if not c: raise HTTPException(404, "Customer not found")
    if body.notes is not None: c.notes = body.notes
    if body.name  is not None: c.name  = body.name
    if body.email is not None: c.email = body.email
    db.commit(); db.refresh(c)
    return cust_to_dict(c)


# ════════════════════════════════════════════════════════════
# LOYALTY
# ════════════════════════════════════════════════════════════
@app.post("/api/loyalty/check")
def check_loyalty(body: LoyaltyCheck, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cfg_setting = db.query(models.Setting).filter(models.Setting.key == "loyalty").first()
    cfg = json.loads(cfg_setting.value) if cfg_setting else {}
    if not cfg.get("enabled", True): return {"eligible": False}
    norm_phone = body.phone.replace(" ", "").replace("-", "")
    cust = db.query(models.Customer).filter(models.Customer.phone == norm_phone).first()
    if not cust: return {"eligible": False}
    visits = len(cust.visits or [])
    threshold = cfg.get("visitThreshold", 3)
    if visits < threshold: return {"eligible": False, "visits": visits, "needed": threshold - visits}
    if cust.last_coupon_used:
        from datetime import timezone
        last = cust.last_coupon_used
        if last.tzinfo is None: last = last.replace(tzinfo=timezone.utc)
        days_since = (datetime.now(timezone.utc) - last).days
        validity = cfg.get("validityDays", 30)
        if days_since < validity: return {"eligible": False, "reason": "recently_used", "nextEligible": validity - days_since}
    code = f"{cfg.get('couponPrefix','WASH')}-{cust.id[-4:].upper()}-{int(datetime.now().timestamp()) % 10000:04X}"
    disc_type = cfg.get("discountType", "percent")
    disc_val = cfg.get("discountValue", 10)
    discount = {"type": disc_type, "value": disc_val, "label": f"{disc_val}% off" if disc_type == "percent" else f"RM {disc_val} off"}
    return {"eligible": True, "visits": visits, "code": code, "discount": discount, "cfg": cfg}

@app.post("/api/loyalty/coupon-usage")
def record_coupon_usage(body: CouponUsage, db: Session = Depends(get_db), _=Depends(get_current_user)):
    norm_phone = body.phone.replace(" ", "").replace("-", "")
    cust = db.query(models.Customer).filter(models.Customer.phone == norm_phone).first()
    if cust:
        cust.last_coupon_used = datetime.utcnow()
        cust.coupons_redeemed = (cust.coupons_redeemed or 0) + 1
        history = list(cust.coupon_history or [])
        history.insert(0, {"code": body.coupon_code, "usedAt": datetime.utcnow().isoformat()})
        cust.coupon_history = history
        db.commit()
    return {"ok": True}


# ════════════════════════════════════════════════════════════
# SETTINGS
# ════════════════════════════════════════════════════════════


@app.get("/api/settings/loyalty")
def get_loyalty(db: Session = Depends(get_db), _=Depends(get_current_user)):
    s = db.query(models.Setting).filter(models.Setting.key == "loyalty").first()
    return json.loads(s.value) if s else {}

@app.put("/api/settings/loyalty")
def set_loyalty(body: dict, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    s = db.query(models.Setting).filter(models.Setting.key == "loyalty").first()
    if s: s.value = json.dumps(body)
    else: db.add(models.Setting(key="loyalty", value=json.dumps(body)))
    db.commit()
    return {"ok": True}

def _get_setting(db, key, default=None, is_json=True):
    s = db.query(models.Setting).filter(models.Setting.key == key).first()
    if not s: return default
    if is_json:
        try: return json.loads(s.value)
        except: return default
    return s.value

def _set_setting(db, key, value, is_json=True):
    s = db.query(models.Setting).filter(models.Setting.key == key).first()
    str_val = json.dumps(value) if is_json else str(value)
    if s: s.value = str_val
    else: db.add(models.Setting(key=key, value=str_val))
    db.commit()

def get_branch_bank_keys(db: Session, branch_id: str, user_id: Optional[int] = None) -> dict:
    if not branch_id:
        if user_id:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            if user and user.role == "SuperAdmin":
                owner_keys = _get_setting(db, f"bank_owner_{user.id}", {})
                if owner_keys and owner_keys.get("accountNumber"):
                    return owner_keys
        return _get_setting(db, "bank_global", {"bankName": "", "accountNumber": "", "accountHolder": ""})
        
    keys = _get_setting(db, f"bank_{branch_id}", {})
    if keys and keys.get("accountNumber"):
        return keys
        
    branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if branch and branch.owner_id:
        owner_keys = _get_setting(db, f"bank_owner_{branch.owner_id}", {})
        if owner_keys and owner_keys.get("accountNumber"):
            return owner_keys
            
        owner = db.query(models.User).filter(models.User.id == branch.owner_id).first()
        if owner and owner.branch_id:
            legacy_keys = _get_setting(db, f"bank_{owner.branch_id}", {})
            if legacy_keys and legacy_keys.get("accountNumber"):
                return legacy_keys
                
    return {"bankName": "", "accountNumber": "", "accountHolder": ""}

# Bank Details
@app.get("/api/settings/bank")
def get_bank(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    data = get_branch_bank_keys(db, current_user.branch_id, current_user.id)
    
    if data and data.get("acct_encrypted") and data.get("accountNumber") == "••••••••":
        dec = decrypt_secret({
            "key_secret": data.get("acct_encrypted"),
            "iv": data.get("acct_iv"),
            "encrypted": True
        })
        if dec: data["accountNumber"] = dec
        
    return data

@app.put("/api/settings/bank")
def set_bank(body: dict, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    if current_user.role == "SuperAdmin":
        key = f"bank_owner_{current_user.id}"
    else:
        key = f"bank_{current_user.branch_id}" if current_user.branch_id else "bank_global"
    
    acct = body.get("accountNumber", "")
    if acct == "••••••••":
        existing = _get_setting(db, key, {})
        if existing.get("acct_encrypted"):
            dec = decrypt_secret({
                "key_secret": existing.get("acct_encrypted"),
                "iv": existing.get("acct_iv"),
                "encrypted": True
            })
            if dec:
                body["accountNumber"] = dec
        else:
            body["accountNumber"] = existing.get("accountNumber", "")
            
    if "acct_encrypted" in body: del body["acct_encrypted"]
    if "acct_iv" in body: del body["acct_iv"]
        
    _set_setting(db, key, body)
    return {"ok": True}

# ============================================================
# RAZORPAY ENCRYPTION UTILITY
# ============================================================
RAZORPAY_ENCRYPTION_KEY = os.getenv("RAZORPAY_ENCRYPTION_KEY", "")

def encrypt_secret(plain_text: str) -> dict:
    if not plain_text or plain_text == "••••••••":
        return {"key_secret": plain_text, "encrypted": False}
        
    if not RAZORPAY_ENCRYPTION_KEY:
        print("WARNING: RAZORPAY_ENCRYPTION_KEY not set. Using plain text fallback (NOT SECURE).")
        return {"key_secret": plain_text, "encrypted": False}
        
    try:
        key = bytes.fromhex(RAZORPAY_ENCRYPTION_KEY)
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        ct = aesgcm.encrypt(nonce, plain_text.encode("utf-8"), None)
        return {
            "key_secret": base64.b64encode(ct).decode('utf-8'),
            "iv": base64.b64encode(nonce).decode('utf-8'),
            "encrypted": True
        }
    except Exception as e:
        print(f"Encryption failed: {e}")
        return {"key_secret": plain_text, "encrypted": False}

def decrypt_secret(secret_dict) -> str:
    import json
    if isinstance(secret_dict, str):
        if secret_dict.startswith("{"):
            try:
                secret_dict = json.loads(secret_dict)
            except:
                pass
        else:
            return secret_dict
    if not secret_dict or not secret_dict.get("encrypted"):
        return secret_dict.get("key_secret", "") if secret_dict else ""
        
    if not RAZORPAY_ENCRYPTION_KEY:
        print("WARNING: RAZORPAY_ENCRYPTION_KEY not set. Cannot decrypt.")
        return ""
        
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        import base64
        key = bytes.fromhex(RAZORPAY_ENCRYPTION_KEY)
        aesgcm = AESGCM(key)
        nonce = base64.b64decode(secret_dict.get("iv", ""))
        ct = base64.b64decode(secret_dict.get("key_secret", ""))
        return aesgcm.decrypt(nonce, ct, None).decode("utf-8")
    except Exception as e:
        print(f"Decryption failed: {e}")
        return ""

@app.get("/api/settings/supreme-bank")
def get_supreme_bank(db: Session = Depends(get_db)):
    data = _get_setting(db, "bank_global", {"bankName": "", "accountNumber": "", "accountHolder": ""})
    if data and data.get("acct_encrypted") and data.get("accountNumber") == "••••••••":
        dec = decrypt_secret({
            "key_secret": data.get("acct_encrypted"),
            "iv": data.get("acct_iv"),
            "encrypted": True
        })
        if dec: data["accountNumber"] = dec
    return data

def get_supreme_keys(db: Session) -> dict:
    """Supreme Admin's Razorpay credentials, read from where the UI saves them.

    The Payment Settings screen saves via PUT /api/settings/supreme-razorpay,
    which writes PaymentSettings(role="SupremeAdmin"). The subscription payment
    flow historically read the "razorpay_global" setting instead -- a different
    store -- so newly entered keys never took effect and stale/expired keys kept
    being used. Prefer the row the UI writes; fall back to razorpay_global.
    """
    ps = db.query(models.PaymentSettings).filter(
        models.PaymentSettings.role == "SupremeAdmin"
    ).first()
    if ps and ps.razorpay_key:
        return {
            "key_id": ps.razorpay_key,
            "key_secret": ps.razorpay_secret,
            "webhook_secret": ps.webhook_secret,
        }
    return _get_setting(db, "razorpay_global", {}) or {}


def resolve_webhook_secret(keys) -> str:
    """Plaintext webhook signing secret, whatever shape it was stored in.

    PaymentSettings stores webhook_secret as a JSON STRING
    '{"key_secret":..,"iv":..,"encrypted":true}'. Feeding that to decrypt_secret()
    as top-level fields returns the raw JSON, so the HMAC is computed with the
    wrong secret, Razorpay's call is rejected as "Invalid signature", and a paid
    order never flips to PAID.
    """
    if not keys:
        return ""
    ws = keys.get("webhook_secret")
    if isinstance(ws, str) and ws.strip().startswith("{"):
        return decrypt_secret(ws)
    return decrypt_secret({
        "key_secret": keys.get("webhook_secret", ""),
        "iv": keys.get("webhook_iv", ""),
        "encrypted": keys.get("webhook_encrypted", False),
    })


def resolve_key_secret(keys) -> str:
    """Return the PLAINTEXT Razorpay key secret, whatever shape it was stored in.

    Three shapes exist in this codebase:
      1. razorpay_global (settings)      -> {"key_id","key_secret","iv","encrypted"}
      2. payment_settings via /api/settings/razorpay
                                         -> key_secret is a JSON STRING
                                            '{"key_secret":..,"iv":..,"encrypted":true}'
      3. payment_settings via /api/admin/payment_settings -> plain text
    decrypt_secret() only understands shape 1. Given shape 2 it returns the raw
    JSON string, which Razorpay rejects with "Authentication failed".
    """
    if not keys:
        return ""
    ks = keys.get("key_secret")
    if isinstance(ks, str) and ks.strip().startswith("{"):
        return decrypt_secret(ks)      # shape 2
    return decrypt_secret(keys)        # shape 1, and shape 3 (returns as-is)


def get_branch_razorpay_keys(db: Session, branch_id: str, user_id: int = None) -> dict:
    if not branch_id:
        if user_id:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            if user and user.role == "SuperAdmin":
                ps = db.query(models.PaymentSettings).filter(models.PaymentSettings.owner_id == str(user.id), models.PaymentSettings.role == "SuperAdmin").first()
                if ps and ps.razorpay_key:
                    return {"key_id": ps.razorpay_key, "key_secret": ps.razorpay_secret, "webhook_secret": ps.webhook_secret}
        
        return {}
        
    ps = db.query(models.PaymentSettings).filter(models.PaymentSettings.owner_id == str(branch_id), models.PaymentSettings.role == "BranchAdmin").first()
    if ps and ps.razorpay_key:
        return {"key_id": ps.razorpay_key, "key_secret": ps.razorpay_secret, "webhook_secret": ps.webhook_secret}
        
    branch = db.query(models.Branch).filter(models.Branch.id == branch_id).first()
    if branch and branch.owner_id:
        ps = db.query(models.PaymentSettings).filter(models.PaymentSettings.owner_id == str(branch.owner_id), models.PaymentSettings.role == "SuperAdmin").first()
        if ps and ps.razorpay_key:
            return {"key_id": ps.razorpay_key, "key_secret": ps.razorpay_secret, "webhook_secret": ps.webhook_secret}

    # FALLBACK (additive): /api/admin/payment_settings saves a Super Admin's row with
    # owner_id = branch_id (not user id, not role "BranchAdmin"), so none of the
    # lookups above match it and the QR fails with "Razorpay is not configured".
    # Match that row here without changing how anything is saved.
    ps = db.query(models.PaymentSettings).filter(
        models.PaymentSettings.owner_id == str(branch_id)
    ).first()
    if ps and ps.razorpay_key:
        return {"key_id": ps.razorpay_key, "key_secret": ps.razorpay_secret, "webhook_secret": ps.webhook_secret}

    return {}

@app.get("/api/settings/razorpay")
def get_razorpay(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    data = get_branch_razorpay_keys(db, current_user.branch_id, current_user.id)
    if not data:
        data = {"key_id": "", "key_secret": ""}
    if data.get("key_secret"):
        data["key_secret"] = "••••••••"
    if data.get("webhook_secret"):
        data["webhook_secret"] = "••••••••"
    return data

@app.put("/api/settings/razorpay")
def set_razorpay(body: dict, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    import json
    if current_user.role == "SuperAdmin":
        owner_id = str(current_user.id)
        role = "SuperAdmin"
    else:
        owner_id = str(current_user.branch_id) if current_user.branch_id else "global"
        role = "BranchAdmin"
        
    ps = db.query(models.PaymentSettings).filter(models.PaymentSettings.owner_id == owner_id, models.PaymentSettings.role == role).first()
    if not ps:
        ps = models.PaymentSettings(owner_id=owner_id, role=role)
        db.add(ps)
    
    new_secret = body.get("key_secret", "")
    if new_secret and new_secret != "••••••••":
        enc_data = encrypt_secret(new_secret)
        ps.razorpay_secret = json.dumps(enc_data)
        
    new_webhook = body.get("webhook_secret", "")
    if new_webhook and new_webhook != "••••••••":
        enc_data = encrypt_secret(new_webhook)
        ps.webhook_secret = json.dumps(enc_data)
        
    ps.razorpay_key = body.get("key_id", ps.razorpay_key)
    db.commit()
    return {"ok": True}

@app.get("/api/settings/supreme-razorpay")
def get_supreme_razorpay(db: Session = Depends(get_db)):
    ps = db.query(models.PaymentSettings).filter(models.PaymentSettings.role == "SupremeAdmin").first()
    data = {"key_id": "", "key_secret": "", "webhook_secret": ""}
    if ps:
        data["key_id"] = ps.razorpay_key or ""
        data["key_secret"] = "••••••••" if ps.razorpay_secret else ""
        data["webhook_secret"] = "••••••••" if ps.webhook_secret else ""
    return data

@app.put("/api/settings/supreme-razorpay")
def set_supreme_razorpay(body: dict, db: Session = Depends(get_db), _=Depends(require_super_admin)):
    import json
    ps = db.query(models.PaymentSettings).filter(models.PaymentSettings.role == "SupremeAdmin").first()
    if not ps:
        ps = models.PaymentSettings(owner_id="SUPREME", role="SupremeAdmin")
        db.add(ps)
        
    new_secret = body.get("key_secret", "")
    if new_secret and new_secret != "••••••••":
        enc_data = encrypt_secret(new_secret)
        ps.razorpay_secret = json.dumps(enc_data)
        
    new_webhook = body.get("webhook_secret", "")
    if new_webhook and new_webhook != "••••••••":
        enc_data = encrypt_secret(new_webhook)
        ps.webhook_secret = json.dumps(enc_data)
        
    ps.razorpay_key = body.get("key_id", ps.razorpay_key)
    db.commit()
    return {"ok": True}


# GST
@app.get("/api/settings/gst")
def get_gst(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    key = f"gst_{current_user.branch_id}" if current_user.branch_id else "gst_global"
    val = _get_setting(db, key, None)
    if val is None:
        val = _get_setting(db, "gst", {"enabled": False, "rate": 0})
    return val

@app.put("/api/settings/gst")
def set_gst(body: dict, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    key = f"gst_{current_user.branch_id}" if current_user.branch_id else "gst_global"
    _set_setting(db, key, body)
    return {"ok": True}

@app.get("/api/settings/qr")
def get_qr(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    key = f"qr_{current_user.branch_id}" if current_user.branch_id else "qr_global"
    val = _get_setting(db, key, {"value": "Payment"})
    return val

@app.put("/api/settings/qr")
def set_qr(body: dict, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    key = f"qr_{current_user.branch_id}" if current_user.branch_id else "qr_global"
    _set_setting(db, key, body)
    return {"ok": True}

@app.get("/api/settings/supreme-qr")
def get_supreme_qr(db: Session = Depends(get_db)):
    val = _get_setting(db, "supreme_qr_data", {"value": "Payment"})
    return val

@app.put("/api/settings/supreme-qr")
def set_supreme_qr(body: dict, db: Session = Depends(get_db), _=Depends(require_super_admin)):
    _set_setting(db, "supreme_qr_data", body)
    return {"ok": True}

# ════════════════════════════════════════════════════════════
# RAZORPAY PAYMENT INTEGRATION
# ════════════════════════════════════════════════════════════
class PaymentCreate(BaseModel):
    amount: float
    for_subscription: bool = False
    currency: Optional[str] = "MYR"

class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    for_subscription: bool = False

class RazorpayKeyRequest(BaseModel):
    for_subscription: bool = False

@app.post("/api/payment/razorpay-key")
def get_razorpay_key(body: RazorpayKeyRequest, db: Session = Depends(get_db), authorization: Optional[str] = Header(None)):
    """Return ONLY the Razorpay Key ID to the frontend. The secret is NEVER exposed."""
    if body.for_subscription:
        keys = get_supreme_keys(db)
    else:
        user = get_current_user(authorization, db)
        keys = get_branch_razorpay_keys(db, user.branch_id)
    
    key_id = keys.get("key_id", "")
    if not key_id:
        raise HTTPException(400, "Razorpay is not configured")
    
    return {"key_id": key_id}

@app.post("/api/payment/create-order")
def create_payment_order(body: PaymentCreate, db: Session = Depends(get_db), authorization: Optional[str] = Header(None)):
    try:
        import razorpay
        if body.for_subscription:
            keys = get_supreme_keys(db)
        else:
            user = get_current_user(authorization, db)
            keys = get_branch_razorpay_keys(db, user.branch_id, user.id)
        
        key_id = keys.get("key_id")
        key_secret = resolve_key_secret(keys)
        if not key_id or not key_secret:
            raise HTTPException(400, "Razorpay is not configured for this branch")
            
        client = razorpay.Client(auth=(key_id, key_secret))
        order = client.order.create({
            "amount": int(round(body.amount * 100)),
            "currency": body.currency or "MYR",
            "payment_capture": "1"
        })
        return {"order_id": order["id"]}
    except Exception as e:
        error_msg = str(e)
        if "Authentication failed" in error_msg or "unauthorized" in error_msg.lower():
            raise HTTPException(400, "Invalid Razorpay Keys. Please check the Super Admin's Payment Gateway Settings.")
        raise HTTPException(500, f"Razorpay Error: {error_msg}")

@app.post("/api/payment/verify-payment")
def verify_payment_signature(body: PaymentVerify, db: Session = Depends(get_db), authorization: Optional[str] = Header(None)):
    try:
        import razorpay
        if body.for_subscription:
            keys = get_supreme_keys(db)
        else:
            user = get_current_user(authorization, db)
            keys = get_branch_razorpay_keys(db, user.branch_id, user.id)
            
        key_id = keys.get("key_id")
        key_secret = resolve_key_secret(keys)
        if not key_id or not key_secret:
            raise HTTPException(400, "Razorpay is not configured for this branch")
            
        client = razorpay.Client(auth=(key_id, key_secret))
        client.utility.verify_payment_signature({
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
            "razorpay_signature": body.razorpay_signature
        })
        return {"ok": True}
    except Exception as e:
        raise HTTPException(400, "Invalid payment signature or verification failed")

class SubscriptionQRRequest(BaseModel):
    plan_id: str
    amount: float

@app.post("/api/payment/subscription/qr")
def create_subscription_qr(body: SubscriptionQRRequest, db: Session = Depends(get_db), authorization: Optional[str] = Header(None)):
    import uuid
    import requests
    user = get_current_user(authorization, db)
    
    keys = get_supreme_keys(db)
    key_id = keys.get("key_id")
    key_secret = resolve_key_secret(keys)
    if not key_id or not key_secret:
        raise HTTPException(400, "Razorpay is not configured by Supreme Admin")
        
    order_number = f"SUB-{uuid.uuid4().hex[:8].upper()}"
    
    order = models.SubscriptionOrder(
        order_number=order_number,
        branch_id=user.branch_id or getattr(user, 'branchId', None),
        plan_id=body.plan_id,
        amount=body.amount,
        status="PENDING"
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    
    url = "https://api.razorpay.com/v1/payments/qr_codes"
    auth = (key_id, key_secret)
    payload = {
        "type": "upi_qr",
        "name": "WashPro Subscription",
        "usage": "single_use",
        "fixed_amount": True,
        "payment_amount": int(body.amount * 100),
        "description": f"Subscription {body.plan_id}",
        "notes": {
            "order_number": order_number
        }
    }
    
    resp = requests.post(url, json=payload, auth=auth)
    if resp.status_code >= 400:
        db.delete(order)
        db.commit()
        raise HTTPException(400, f"Razorpay QR API Error: {resp.text}")
        
    data = resp.json()
    order.razorpay_qr_id = data.get("id")
    db.commit()
    
    return {
        "order_number": order_number,
        "qr_code_url": data.get("image_url")
    }

@app.get("/api/payment/subscription/status/{order_number}")
def get_subscription_status(order_number: str, db: Session = Depends(get_db)):
    order = db.query(models.SubscriptionOrder).filter(
        (models.SubscriptionOrder.order_number == order_number) |
        (models.SubscriptionOrder.razorpay_qr_id == order_number)
    ).first()
    if order:
        debug_info = None
        if order.status != "PAID" and order.razorpay_qr_id:
            try:
                import razorpay
                keys = get_supreme_keys(db)
                key_id = keys.get("key_id", "") if keys else ""
                key_secret = resolve_key_secret(keys) if keys else ""
                if key_id and key_secret:
                    client = razorpay.Client(auth=(key_id, key_secret))
                    is_paid = False
                    paid_payment_id = None
                    if order.razorpay_qr_id.startswith("plink_"):
                        pl = client.payment_link.fetch(order.razorpay_qr_id)
                        debug_info = pl.get("status")
                        is_paid = str(pl.get("status", "")).strip().lower() == "paid"
                        paid_payment_id = pl.get("id")
                    elif order.razorpay_qr_id.startswith("qr_"):
                        # Native UPI QR codes report status via the qr_codes API, not
                        # payment_link.fetch (that 404s for qr_ ids). A QR is "paid"
                        # once Razorpay marks it closed AND it actually received money.
                        qr = client.qrcode.fetch(order.razorpay_qr_id)
                        debug_info = qr.get("status")
                        is_paid = (
                            str(qr.get("status", "")).strip().lower() == "closed"
                            and (qr.get("payments_amount_received", 0) or 0) > 0
                        )
                        paid_payment_id = qr.get("id")
                    if is_paid:
                        order.status = "PAID"
                        order.paid_at = datetime.utcnow()
                        db.commit()
                        
                        # Update Branch subscription and expiry date
                        branch = db.query(models.Branch).filter(models.Branch.id == order.branch_id).first()
                        if branch:
                            branch.subscription = order.plan_id
                            plan = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == order.plan_id).first()
                            months = 12 if (plan and "annual" in plan.duration.lower()) else 1
                            now = datetime.utcnow()
                            branch.expiry_date = (now + timedelta(days=30*months)).strftime("%d/%m/%Y")
                            
                        # Also update SubscriptionTransaction if it exists
                        tx = db.query(models.SubscriptionTransaction).filter(models.SubscriptionTransaction.branch_id == order.branch_id, models.SubscriptionTransaction.status == "Pending").first()
                        if tx:
                            tx.status = "Verified"
                            tx.payment_date = datetime.utcnow().strftime("%d %b %Y, %I:%M %p")
                            tx.transaction_id = paid_payment_id or tx.transaction_id
                            
                        db.commit()
            except Exception as e:
                print("Error actively checking Razorpay:", e)
                debug_info = str(e)
                
        return {
            "status": order.status,
            "paid_at": order.paid_at,
            "payment_id": order.razorpay_payment_id,
            "order_number": order.order_number,
            "qr_id": order.razorpay_qr_id,
            "debug": debug_info
        }

    # Fallback: invoice QRs / older links are tracked in the Payment ledger by the
    # Razorpay qr/payment-link id. Report those rather than 404-ing.
    pay = db.query(models.Payment).filter(models.Payment.qr_id == order_number).first()
    
    if not pay:
        for p in db.query(models.Payment).order_by(models.Payment.id.desc()).limit(100).all():
            if p.meta_data:
                if p.meta_data.get("order_number") == order_number or p.meta_data.get("job_id") == order_number:
                    pay = p
                    break

    if pay:
        debug_info = None
        if str(pay.status).upper() not in ("SUCCESS", "PAID", "CAPTURED") and pay.qr_id:
            try:
                import razorpay
                keys = get_branch_razorpay_keys(db, pay.owner_id)
                key_id = keys.get("key_id", "") if keys else ""
                key_secret = resolve_key_secret(keys) if keys else ""
                if key_id and key_secret:
                    client = razorpay.Client(auth=(key_id, key_secret))
                    is_paid = False
                    paid_payment_id = None
                    if pay.qr_id.startswith("plink_"):
                        pl = client.payment_link.fetch(pay.qr_id)
                        debug_info = pl.get("status")
                        is_paid = str(pl.get("status", "")).strip().lower() == "paid"
                        paid_payment_id = pl.get("id")
                    elif pay.qr_id.startswith("qr_"):
                        qr = client.qrcode.fetch(pay.qr_id)
                        debug_info = qr.get("status")
                        is_paid = (
                            str(qr.get("status", "")).strip().lower() == "closed"
                            and (qr.get("payments_amount_received", 0) or 0) > 0
                        )
                        paid_payment_id = qr.get("id")
                    if is_paid:
                        pay.status = "SUCCESS"
                        pay.payment_id = paid_payment_id
                        
                        # also update job status
                        if pay.meta_data and pay.meta_data.get("job_id"):
                            job_id = pay.meta_data.get("job_id")
                            job = db.query(models.PendingJob).filter(models.PendingJob.id == job_id).first()
                            if job:
                                job.status = "paid"
                                
                        db.commit()
            except Exception as e:
                print("Error actively checking Razorpay for invoice:", e)
                debug_info = str(e)
                
        return {"status": "PAID" if str(pay.status).upper() in ("SUCCESS", "PAID", "CAPTURED") else "PENDING",
                "paid_at": None,
                "payment_id": pay.payment_id,
                "qr_id": pay.qr_id,
                "debug": debug_info}

    raise HTTPException(404, "Order not found")

from fastapi import Request
import hmac
import hashlib

@app.post("/api/webhook/razorpay/old")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    if not signature:
        raise HTTPException(400, "Missing signature")
        
    keys = get_supreme_keys(db)
    webhook_secret = resolve_webhook_secret(keys)
    
    if not webhook_secret:
        raise HTTPException(400, "Webhook secret not configured")
        
    expected_sig = hmac.new(
        webhook_secret.encode('utf-8'),
        body,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(expected_sig, signature):
        raise HTTPException(400, "Invalid signature")
        
    payload = json.loads(body)
    event = payload.get("event")
    
    if event not in ["payment.captured", "payment.authorized", "order.paid",
                      "payment_link.paid", "payment_link.completed", "qr_code.credited"]:
        return {"status": "ignored"}

    payload_data = payload.get("payload", {})
    payment_entity = payload_data.get("payment", {}).get("entity", {}) or {}
    payment_link_entity = payload_data.get("payment_link", {}).get("entity", {}) or {}
    order_entity = payload_data.get("order", {}).get("entity", {}) or {}
    qr_code_entity = payload_data.get("qr_code", {}).get("entity", {}) or {}

    notes = (payment_entity.get("notes") or payment_link_entity.get("notes")
             or order_entity.get("notes") or qr_code_entity.get("notes") or {})

    payment_type = notes.get("type")
    reference_id = notes.get("reference_id")
    order_number_from_notes = notes.get("order_number")
    payment_link_id = payment_link_entity.get("id")
    qr_code_id = qr_code_entity.get("id")
    payment_id = payment_entity.get("id")

    if not reference_id and not order_number_from_notes and not qr_code_id:
        return {"status": "no reference id"}
        
    lookup_id = order_number_from_notes or reference_id

    order = db.query(models.SubscriptionOrder).filter(
        (models.SubscriptionOrder.order_number == lookup_id) |
        (models.SubscriptionOrder.razorpay_qr_id == payment_link_id) |
        (models.SubscriptionOrder.razorpay_qr_id == qr_code_id) |
        (models.SubscriptionOrder.razorpay_payment_id == payment_id)
    ).first()

    if not order or order.status == "PAID":
        return {"ok": True, "msg": "Order already processed or not found"}
        
    order.status = "PAID"
    order.razorpay_payment_id = payment_id
    order.paid_at = datetime.utcnow()
        
    branch = db.query(models.Branch).filter(models.Branch.id == order.branch_id).first()
    if branch:
        branch.subscription = order.plan_id
        plan = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == order.plan_id).first()
        months = 12 if (plan and "annual" in plan.duration.lower()) else 1
        now = datetime.utcnow()
        branch.expiry_date = (now + timedelta(days=30*months)).strftime("%d/%m/%Y")
        
    tx_currency = (payment_entity.get("currency") or payment_link_entity.get("currency") 
                   or order_entity.get("currency") or qr_code_entity.get("currency") or "MYR")

    tx = models.SubscriptionTransaction(
        branch_id=order.branch_id,
        plan_id=order.plan_id,
        amount=order.amount,
        currency=tx_currency,
        transaction_id=order.razorpay_payment_id,
        payment_date=datetime.utcnow().strftime("%d/%m/%Y"),
        status="Verified"
    )
    db.add(tx)
    db.commit()
    
    return {"ok": True}


# ════════════════════════════════════════════════════════════
# GOOGLE VISION — Car Analysis + Plate Recognition
# ════════════════════════════════════════════════════════════
@app.post("/api/vision/analyze-car")
async def analyze_car(
    file: UploadFile = File(...),
    _: models.User = Depends(get_current_user)
):
    """
    Upload a car image. Returns detected plate number, car labels, and objects.
    Uses Google Cloud Vision API.
    """
    import httpx, base64

    api_key = os.getenv("GOOGLE_VISION_API_KEY")
    if not api_key:
        raise HTTPException(500, "Google Vision API key not configured")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(400, "Image too large. Max 10MB.")

    encoded = base64.b64encode(image_bytes).decode("utf-8")
    payload = {
        "requests": [{
            "image": {"content": encoded},
            "features": [
                {"type": "TEXT_DETECTION", "maxResults": 10},
                {"type": "LABEL_DETECTION", "maxResults": 15},
                {"type": "OBJECT_LOCALIZATION", "maxResults": 10},
                {"type": "IMAGE_PROPERTIES"},
                {"type": "WEB_DETECTION", "maxResults": 5},
            ]
        }]
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"https://vision.googleapis.com/v1/images:annotate?key={api_key}",
            json=payload
        )

    if response.status_code != 200:
        raise HTTPException(502, f"Vision API error: {response.text}")

    data = response.json()
    result = data.get("responses", [{}])[0]

    # Extract raw texts
    texts = result.get("textAnnotations", [])
    raw_texts = [t["description"] for t in texts[:10]] if texts else []

    # Extract car labels and objects
    labels = [l["description"] for l in result.get("labelAnnotations", [])]
    objects = [o["name"] for o in result.get("localizedObjectAnnotations", [])]

    # Extract dominant colour from labels first, then fallback to image properties
    dominant_colour = "Unknown"
    color_names = ["Black", "White", "Silver", "Grey", "Gray", "Red", "Blue", "Brown", "Gold", "Yellow", "Green", "Orange"]
    for l in labels + objects:
        for c in color_names:
            if c.lower() in l.lower():
                dominant_colour = "Grey" if c == "Gray" else c
                break
        if dominant_colour != "Unknown":
            break
            
    if dominant_colour == "Unknown":
        props = result.get("imagePropertiesAnnotation", {})
        dom_colours = props.get("dominantColors", {}).get("colors", [])
        if dom_colours:
            top = dom_colours[0]["color"]
            r, g, b = top.get("red", 0), top.get("green", 0), top.get("blue", 0)
            if r > 200 and g > 200 and b > 200: dominant_colour = "White"
            elif r < 65 and g < 65 and b < 65: dominant_colour = "Black"
            elif r > 150 and g > 150 and b > 150: dominant_colour = "Silver"
            elif r > 150 and g < 100 and b < 100: dominant_colour = "Red"
            elif b > 150 and r < 100 and g < 100: dominant_colour = "Blue"
            elif r < 130 and g < 130 and b < 130: dominant_colour = "Grey"
            elif r > 150 and g > 100 and b < 80: dominant_colour = "Brown"
            elif r > 180 and g > 150 and b < 80: dominant_colour = "Gold"
            else: dominant_colour = "Silver"

    # Extract web entities for make/model
    web = result.get("webDetection", {})
    web_entities = [e.get("description", "") for e in web.get("webEntities", []) if e.get("score", 0) > 0.3]
    web_labels = web.get("bestGuessLabels", [])
    best_guess = web_labels[0].get("label", "") if web_labels else ""

    # Try to extract car make/model from all available text
    car_makes = ["Toyota", "Honda", "Proton", "Perodua", "Nissan", "Mazda", "Mitsubishi",
                 "BMW", "Mercedes", "Mercedes-Benz", "Volkswagen", "Ford", "Hyundai", "Kia",
                 "Suzuki", "Isuzu", "Subaru", "Lexus", "Daihatsu", "Renault", "Peugeot",
                 "Audi", "Volvo", "Chevrolet", "Jeep", "Land Rover", "Range Rover"]
    car_models = ["Hilux", "Vios", "Camry", "Fortuner", "Innova", "Rush", "Yaris", "Avanza",
                  "RAV4", "Harrier", "Land Cruiser", "Prado", "Alphard", "Vellfire",
                  "Civic", "City", "Jazz", "HR-V", "CR-V", "Accord", "BR-V",
                  "Saga", "Myvi", "Axia", "Bezza", "Persona", "Ativa", "Aruz", "X50", "X70",
                  "X-Trail", "Almera", "Navara", "Serena", "Kicks", "Terra",
                  "CX-5", "CX-3", "CX-8", "Triton", "Pajero", "Outlander", "ASX",
                  "Ranger", "BT-50", "Everest", "Veloz", "Raize", "Rocky", "Alcazar"]

    all_sources = " ".join(labels + objects + web_entities + [best_guess, texts[0]["description"].replace('\\n', ' ') if texts else ""])
    detected_make = next((m for m in car_makes if m.lower() in all_sources.lower()), "Unknown")
    detected_model = next((m for m in car_models if m.lower() in all_sources.lower()), "Unknown")

    if detected_make != "Unknown" and detected_model == "Unknown" and best_guess:
        bg_lower = best_guess.lower()
        make_lower = detected_make.lower()
        if make_lower in bg_lower:
            after_make = best_guess[bg_lower.index(make_lower) + len(detected_make):].strip()
            words = after_make.split()
            if words:
                candidate = words[0].strip("(),.")
                if len(candidate) > 2 and candidate.isalpha():
                    detected_model = candidate.capitalize()

    # Plate number heuristic
    plate_number = None
    
    # Look for the best plate-like string in all text blocks (skipping texts[0] which is the full image text)
    import re
    best_plate = None
    if len(texts) > 1:
        for t in texts[1:]:
            word = t.get("description", "")
            clean_t = word.replace(' ', '').replace('-', '')
            # A valid plate usually has 4 to 12 chars, letters, and numbers
            if len(clean_t) >= 4 and len(clean_t) <= 12 and any(c.isdigit() for c in clean_t) and any(c.isalpha() for c in clean_t):
                if not best_plate or len(clean_t) > len(best_plate):
                    best_plate = clean_t
                
    if best_plate:
        plate_number = best_plate
    elif texts:
        # Fallback regex on the entire document text
        full_text = texts[0]["description"].replace('\\n', ' ')
        plate_match = re.search(r'([A-Z]{1,4}[\s\-]*\d{1,4}[\s\-]*[A-Z]{0,3}[\s\-]*\d{0,4})', full_text)
        if plate_match:
            plate_number = plate_match.group(1).replace(' ', '').replace('-', '')
        else:
            plate_number = texts[0]["description"].strip()[:15] # Failsafe

    return {
        "plate_number": plate_number,
        "car_make": detected_make,
        "car_model": detected_model,
        "car_colour": dominant_colour,
        "labels": labels,
        "objects": objects,
        "raw_texts": raw_texts,
        "web_entities": web_entities[:8],
        "best_guess": best_guess,
    }


# ════════════════════════════════════════════════════════════
# INTERNAL — Customer upsert on session creation
# ════════════════════════════════════════════════════════════
def _upsert_customer(db: Session, s: models.Session):
    cust_data = s.customer or {}
    phone = cust_data.get("phone", "").replace(" ", "")
    if not phone: return
    visit = {
        "sessionId": s.id, "date": s.date, "vehicle": s.vehicle,
        "package": s.package.get("name") if s.package else None,
        "amount": s.total, "washer": s.washer, "branchId": s.branch_id,
        "couponUsed": s.coupon.get("code") if s.coupon else None,
    }
    existing = db.query(models.Customer).filter(models.Customer.phone == phone).first()
    if existing:
        visits = list(existing.visits or [])
        visits.insert(0, visit)
        existing.visits = visits
        existing.total_spend = (existing.total_spend or 0) + (s.total or 0)
        existing.last_visit = s.date
        if cust_data.get("name"):  existing.name  = cust_data["name"]
        if cust_data.get("email"): existing.email = cust_data["email"]
        if s.coupon and s.coupon.get("code"):
            history = list(existing.coupon_history or [])
            if not any(c.get("code") == s.coupon["code"] for c in history):
                existing.last_coupon_used = datetime.utcnow()
                existing.coupons_redeemed = (existing.coupons_redeemed or 0) + 1
                history.insert(0, {"code": s.coupon["code"], "usedAt": datetime.utcnow().isoformat()})
                existing.coupon_history = history
    else:
        cid = next_customer_id(db)
        db.add(models.Customer(
            id=cid, name=cust_data.get("name", "Walk-in"), phone=phone,
            email=cust_data.get("email", ""), branch_id=s.branch_id,
            total_spend=s.total or 0, last_visit=s.date,
            visits=[visit], coupon_history=[], coupons_redeemed=0,
        ))


# ════════════════════════════════════════════════════════════
# INVENTORY
# ════════════════════════════════════════════════════════════
import uuid as _uuid

@app.get("/api/inventory/")
def list_inventory(
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.InventoryItem).filter(models.InventoryItem.is_active == True)
    if current_user.role in ("SuperAdmin", "Admin", "Washer"):
        owned_ids = get_owned_branch_ids(db, current_user)
        if owned_ids:
            q = q.filter(
                (models.InventoryItem.branch_id.in_(owned_ids)) |
                (models.InventoryItem.branch_id == None)
            )
    if category:
        q = q.filter(models.InventoryItem.category.ilike(f"%{category}%"))
    if search:
        q = q.filter(models.InventoryItem.name.ilike(f"%{search}%"))
    return [inventory_item_to_dict(i) for i in q.order_by(models.InventoryItem.name).all()]

@app.post("/api/inventory/", status_code=201)
def create_inventory_item(body: InventoryItemIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    if not body.name or not body.name.strip():
        raise HTTPException(400, "Item name is required")
    if not body.category or not body.category.strip():
        raise HTTPException(400, "Category is required")
    branch_id = body.branch_id
    if current_user.role in ("SuperAdmin", "Admin"):
        owned_ids = get_owned_branch_ids(db, current_user)
        branch_id = body.branch_id if body.branch_id in owned_ids else (owned_ids[0] if owned_ids else None)
    new_id = f"INV-{_uuid.uuid4().hex[:8].upper()}"
    item = models.InventoryItem(
        id=new_id, name=body.name.strip(), category=body.category.strip(),
        quantity=body.quantity, threshold=body.threshold,
        description=body.description, price=body.price, cost=body.cost,
        barcode=body.barcode, branch_id=branch_id, washes_per_unit=body.washes_per_unit,
        is_active=True, created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
    )
    db.add(item); db.commit(); db.refresh(item)
    item_dict = inventory_item_to_dict(item)
    background_tasks.add_task(manager.broadcast_event, "inventory.created", {"item": item_dict, "message": f"New inventory item '{item.name}' added"}, branch_id)
    return item_dict

@app.get("/api/inventory/{item_id}")
def get_inventory_item(item_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    item = db.query(models.InventoryItem).filter(
        models.InventoryItem.id == item_id,
        models.InventoryItem.is_active == True,
    ).first()
    if not item: raise HTTPException(404, "Inventory item not found")
    return inventory_item_to_dict(item)

@app.put("/api/inventory/{item_id}")
def update_inventory_item(item_id: str, body: InventoryItemUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    item = db.query(models.InventoryItem).filter(
        models.InventoryItem.id == item_id,
        models.InventoryItem.is_active == True,
    ).first()
    if not item: raise HTTPException(404, "Inventory item not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    item.updated_at = datetime.utcnow()
    db.commit(); db.refresh(item)
    item_dict = inventory_item_to_dict(item)
    background_tasks.add_task(manager.broadcast_event, "inventory.updated", {"item": item_dict, "message": f"Inventory '{item.name}' updated"}, item.branch_id)
    return item_dict

@app.delete("/api/inventory/{item_id}")
def delete_inventory_item(item_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    item = db.query(models.InventoryItem).filter(
        models.InventoryItem.id == item_id,
        models.InventoryItem.is_active == True,
    ).first()
    if not item: raise HTTPException(404, "Inventory item not found")
    item_name = item.name
    item_branch = item.branch_id
    item.is_active = False
    item.updated_at = datetime.utcnow()
    db.commit()
    background_tasks.add_task(manager.broadcast_event, "inventory.deleted", {"itemId": item_id, "message": f"Inventory item '{item_name}' removed"}, item_branch)
    return {"ok": True, "id": item_id, "message": "Item deactivated (soft deleted)"}

@app.post("/api/inventory/{item_id}/restock")
def restock_inventory_item(item_id: str, body: RestockIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    if body.quantity <= 0:
        raise HTTPException(400, "Restock quantity must be greater than zero")
    item = db.query(models.InventoryItem).filter(
        models.InventoryItem.id == item_id,
        models.InventoryItem.is_active == True,
    ).first()
    if not item: raise HTTPException(404, "Inventory item not found")
    item.quantity += body.quantity
    item.updated_at = datetime.utcnow()
    hist = models.InventoryHistory(
        item_id=item_id, event_type="stock_in", quantity_change=body.quantity,
        created_by=current_user.name, created_at=datetime.utcnow(),
    )
    db.add(hist); db.commit(); db.refresh(item)
    item_dict = inventory_item_to_dict(item)
    background_tasks.add_task(manager.broadcast_event, "inventory.restocked", {"item": item_dict, "message": f"'{item.name}' restocked (+{body.quantity})"}, item.branch_id)
    return {**item_dict, "history_event": inventory_history_to_dict(hist)}

@app.post("/api/inventory/{item_id}/use")
def use_inventory_item(item_id: str, body: UseStockIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if body.quantity <= 0:
        raise HTTPException(400, "Use quantity must be greater than zero")
    item = db.query(models.InventoryItem).filter(
        models.InventoryItem.id == item_id,
        models.InventoryItem.is_active == True,
    ).first()
    if not item: raise HTTPException(404, "Inventory item not found")
    clicks_to_use = int(body.quantity)
    qty = float(getattr(item, 'quantity', 0.0) or 0.0)
    total_available_clicks = int(qty)
    
    if total_available_clicks < clicks_to_use:
        raise HTTPException(400, f"Insufficient stock. Available clicks: {total_available_clicks}, requested: {clicks_to_use}")
        
    item.quantity = max(0.0, qty - float(clicks_to_use))
    item.updated_at = datetime.utcnow()
    
    hist = models.InventoryHistory(
        item_id=item_id, event_type="stock_out", quantity_change=-float(clicks_to_use),
        created_by=current_user.name, created_at=datetime.utcnow(),
    )
    db.add(hist); db.commit(); db.refresh(item)
    item_dict = inventory_item_to_dict(item)
    background_tasks.add_task(manager.broadcast_event, "inventory.updated", {"item": item_dict, "message": f"'{item.name}' stock used"}, item.branch_id)
    return {**item_dict, "history_event": inventory_history_to_dict(hist)}

@app.get("/api/inventory/{item_id}/history")
def get_inventory_history(item_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin)):
    item = db.query(models.InventoryItem).filter(models.InventoryItem.id == item_id).first()
    if not item: raise HTTPException(404, "Inventory item not found")
    history = db.query(models.InventoryHistory).filter(
        models.InventoryHistory.item_id == item_id
    ).order_by(models.InventoryHistory.created_at.desc()).all()
    return [inventory_history_to_dict(h) for h in history]


# ════════════════════════════════════════════════════════════
# JOB REQUESTS
# ════════════════════════════════════════════════════════════
@app.get("/api/admin/job-requests")
def list_job_requests(db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    q = db.query(models.CustomerJobRequest).order_by(models.CustomerJobRequest.created_at.desc())
    if current_user.role != "SupremeAdmin":
        q = q.filter(models.CustomerJobRequest.branch_id.in_(get_owned_branch_ids(db, current_user)))

    results = []
    for r in q.all():
        job_data = None
        if r.assigned_job_id:
            j = db.query(models.PendingJob).filter(models.PendingJob.id == r.assigned_job_id).first()
            if j:
                pkg_time = j.package.get("time") if j.package and isinstance(j.package, dict) else None
                job_data = {
                    "status": j.status,
                    "submittedAt": to_iso_utc(j.submitted_at),
                    "packageTime": pkg_time
                }
        results.append({
            "id": r.id,
            "trackingId": r.tracking_id,
            "customerName": r.customer_name,
            "customerPhone": r.customer_phone,
            "address": r.address,
            "branchId": r.branch_id,
            "status": r.status,
            "packageId": r.package_id,
            "assignedJobId": r.assigned_job_id,
            "createdAt": to_iso_utc(r.created_at),
            "job": job_data
        })
    return results

@app.put("/api/admin/job-requests/{req_id}/assign")
def assign_job_request(req_id: str, body: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(require_admin_or_super_admin)):
    r = db.query(models.CustomerJobRequest).filter(models.CustomerJobRequest.id == req_id).first()
    if not r: raise HTTPException(404, "Job request not found")

    # Enforce Limits
    check_branch_limits(db, r.branch_id)

    # Look up the washer
    washer_id = body.get("washer_id")
    if not washer_id:
        raise HTTPException(400, "washer_id is required")
    washer = db.query(models.User).filter(models.User.id == int(washer_id)).first()
    if not washer:
        raise HTTPException(404, "Washer not found")
        
    if washer.role == "Washer" and is_washer_locked(db, washer):
        raise HTTPException(400, "Cannot assign job to a locked washer. Their access is restricted due to subscription limits.")

    # Look up the package if provided
    package_id = body.get("package_id") or r.package_id
    pkg_data = {"name": "To be decided"}
    if package_id:
        pkg = db.query(models.Package).filter(models.Package.id == package_id).first()
        if pkg:
            pkg_data = {"id": pkg.id, "name": pkg.name, "desc": pkg.desc, "price": pkg.price, "time": pkg.time, "color": pkg.color}

    # Look up the branch
    branch = db.query(models.Branch).filter(models.Branch.id == r.branch_id).first()
    branch_name = branch.name if branch else None

    # Create a PendingJob so the washer can see and act on it
    import random, string
    job_id = "JOB-" + "".join(random.choices(string.digits, k=8))

    pending_job = models.PendingJob(
        id=job_id,
        customer={"name": r.customer_name, "phone": r.customer_phone},
        vehicle={"make": "", "model": "", "plate": ""},
        package=pkg_data,
        geo=None,
        location_name=r.address,
        branch_id=r.branch_id,
        branch=branch_name,
        washer_id=washer.id,
        washer=washer.name,
        loyalty=None,
        status="assigned",
    )
    db.add(pending_job)

    # Update the job request
    r.status = "Assigned"
    r.assigned_job_id = job_id
    db.commit()
    db.refresh(r)
    req_dict = {
        "id": r.id,
        "trackingId": r.tracking_id,
        "customerName": r.customer_name,
        "customerPhone": r.customer_phone,
        "address": r.address,
        "branchId": r.branch_id,
        "status": r.status,
        "packageId": r.package_id,
        "assignedJobId": r.assigned_job_id,
        "createdAt": to_iso_utc(r.created_at)
    }
    background_tasks.add_task(
        manager.broadcast_event,
        "jobrequest.assigned",
        {"request": req_dict, "job": job_to_dict(pending_job), "message": f"Job request assigned to {washer.name} for {r.customer_name}"},
        r.branch_id
    )
    return req_dict

@app.get("/api/washer/available-job-requests")
def get_available_job_requests(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "Washer":
        raise HTTPException(403, "Only washers can view available job requests")
    
    branch_id = current_user.branch_id or current_user.branchId
    if not branch_id: return []
        
    q = db.query(models.CustomerJobRequest).filter(
        models.CustomerJobRequest.branch_id == branch_id,
        models.CustomerJobRequest.status == "Pending"
    ).order_by(models.CustomerJobRequest.created_at.desc())
    
    return [
        {
            "id": r.id,
            "trackingId": r.tracking_id,
            "customerName": r.customer_name,
            "customerPhone": r.customer_phone,
            "address": r.address,
            "branchId": r.branch_id,
            "status": r.status,
            "packageId": r.package_id,
            "createdAt": to_iso_utc(r.created_at)
        } for r in q.all()
    ]

@app.post("/api/washer/job-requests/{req_id}/take")
def take_job_request(req_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "Washer":
        raise HTTPException(403, "Only washers can take job requests")
        
    if is_washer_locked(db, current_user):
        raise HTTPException(400, "Your account is locked due to branch subscription limits.")

    r = db.query(models.CustomerJobRequest).filter(models.CustomerJobRequest.id == req_id).first()
    if not r: raise HTTPException(404, "Job request not found")
    
    if r.status != "Pending":
        raise HTTPException(400, "This job request has already been taken or is no longer available.")
        
    branch_id = current_user.branch_id or current_user.branchId
    if r.branch_id != branch_id:
        raise HTTPException(403, "This job request does not belong to your branch.")

    check_branch_limits(db, r.branch_id)

    pkg_data = {"name": "To be decided"}
    if r.package_id:
        pkg = db.query(models.Package).filter(models.Package.id == r.package_id).first()
        if pkg:
            pkg_data = {"id": pkg.id, "name": pkg.name, "desc": pkg.desc, "price": pkg.price, "time": pkg.time, "color": pkg.color, "products": pkg.products}

    branch = db.query(models.Branch).filter(models.Branch.id == r.branch_id).first()
    branch_name = branch.name if branch else None

    import random, string
    job_id = "JOB-" + "".join(random.choices(string.digits, k=8))

    pending_job = models.PendingJob(
        id=job_id,
        customer={"name": r.customer_name, "phone": r.customer_phone},
        vehicle={"make": "", "model": "", "plate": ""},
        package=pkg_data,
        geo=None,
        location_name=r.address,
        branch_id=r.branch_id,
        branch=branch_name,
        washer_id=current_user.id,
        washer=current_user.name,
        loyalty=None,
        status="assigned",
    )
    db.add(pending_job)

    r.status = "Assigned"
    r.assigned_job_id = job_id
    db.commit()
    db.refresh(r)
    background_tasks.add_task(
        manager.broadcast_event,
        "jobrequest.assigned",
        {"request": {"id": r.id, "trackingId": r.tracking_id, "status": r.status, "assignedJobId": job_id, "branchId": r.branch_id}, "job": job_to_dict(pending_job), "message": f"{current_user.name} took job request {r.id}"},
        r.branch_id
    )
    return {"message": "Job taken successfully", "assignedJobId": job_id}

@app.post("/api/public/job-request")
def create_public_job_request(body: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    import random, string
    tracking = "TRK-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    req_id = "REQ-" + "".join(random.choices(string.digits, k=6))
    
    branch_id = body.get("branch_id", body.get("branchId", ""))
    branch = db.query(models.Branch).filter_by(id=branch_id).first()
    if branch and is_branch_locked(db, branch):
        raise HTTPException(403, "This branch is currently locked. Cannot create job requests.")
    
    r = models.CustomerJobRequest(
        id=req_id,
        tracking_id=tracking,
        customer_name=body.get("customer_name", body.get("customerName", "Guest")),
        customer_phone=body.get("customer_phone", body.get("customerPhone", "")),
        address=body.get("address", ""),
        branch_id=body.get("branch_id", body.get("branchId", "")),
        status="Pending",
        package_id=body.get("package_id", body.get("packageId")),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    branch_id_for_event = body.get("branch_id", body.get("branchId", ""))
    background_tasks.add_task(
        manager.broadcast_event,
        "jobrequest.new",
        {"request": {"id": req_id, "trackingId": tracking, "customerName": r.customer_name, "customerPhone": r.customer_phone, "address": r.address, "branchId": r.branch_id, "status": "Pending", "packageId": r.package_id, "createdAt": to_iso_utc(r.created_at)}, "message": f"New job request from {r.customer_name}"},
        branch_id_for_event
    )
    return {"trackingId": tracking, "id": req_id}

@app.get("/api/public/track-job/{tracking_id}")
def track_job(tracking_id: str, db: Session = Depends(get_db)):
    r = db.query(models.CustomerJobRequest).filter(models.CustomerJobRequest.tracking_id == tracking_id).first()
    if not r: raise HTTPException(404, "Tracking ID not found")

    job_data = None
    if r.assigned_job_id:
        j = db.query(models.PendingJob).filter(models.PendingJob.id == r.assigned_job_id).first()
        if j:
            pkg_time = j.package.get("time") if j.package and isinstance(j.package, dict) else None
            job_data = {
                "status": j.status,
                "submittedAt": to_iso_utc(j.submitted_at),
                "packageTime": pkg_time
            }

    return {
        "id": r.id,
        "status": r.status,
        "customerName": r.customer_name,
        "createdAt": to_iso_utc(r.created_at),
        "job": job_data
    }


# ════════════════════════════════════════════════════════════
# VISION — SSM Certificate Analysis
# ════════════════════════════════════════════════════════════
@app.post("/api/vision/analyze-ssm")
async def analyze_ssm(file: UploadFile = File(...)):
    """
    Accepts an uploaded SSM certificate image or PDF.
    Uses PyMuPDF to extract text from PDFs, or Google Cloud Vision API 
    (TEXT_DETECTION) to OCR the document, then extracts the company name 
    and registration number.
    """
    import base64, re, httpx
    try:
        import fitz  # PyMuPDF
    except ImportError:
        fitz = None

    contents = await file.read()
    full_text = ""
    b64_image = ""
    
    is_pdf = file.content_type == "application/pdf" or file.filename.lower().endswith(".pdf")
    
    if is_pdf and fitz:
        try:
            doc = fitz.open(stream=contents, filetype="pdf")
            if len(doc) > 0:
                page = doc[0]
                full_text = page.get_text("text").strip()
                # If the PDF is scanned and has no text, convert to image for OCR
                if not full_text or len(full_text) < 20:
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # zoom for better OCR
                    img_bytes = pix.tobytes("png")
                    b64_image = base64.b64encode(img_bytes).decode("utf-8")
                    full_text = "" # Fallback to Vision API
        except Exception as e:
            print(f"PDF extraction error: {e}")
            return {"company_name": None, "registration_number": None, "error": "Failed to read the PDF file."}
    elif is_pdf and not fitz:
        return {"company_name": None, "registration_number": None, "error": "PDF support (pymupdf) is not installed on the server."}

    # If it's not a PDF or the PDF was scanned (no text), use Vision API
    if not full_text:
        api_key = os.getenv("GOOGLE_VISION_API_KEY")
        if not api_key:
            raise HTTPException(500, "Google Vision API key not configured")

        if not is_pdf:
            if file.content_type and not file.content_type.startswith("image/"):
                return {"company_name": None, "registration_number": None, "error": "Auto-extraction is only supported for images and PDFs."}
            b64_image = base64.b64encode(contents).decode("utf-8")
            
        vision_url = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"
        payload = {
            "requests": [{
                "image": {"content": b64_image},
                "features": [{"type": "TEXT_DETECTION", "maxResults": 1}]
            }]
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(vision_url, json=payload)
                resp.raise_for_status()
                result = resp.json()
                
            responses = result.get("responses", [])
            if responses and "textAnnotations" in responses[0]:
                annotations = responses[0]["textAnnotations"]
                if annotations:
                    full_text = annotations[0].get("description", "")
        except Exception as e:
            print(f"Vision API error: {e}")
            return {"company_name": None, "registration_number": None, "error": "Could not process document automatically. Please enter your details manually."}

    if not full_text:
        return {"company_name": None, "registration_number": None}

    lines = [l.strip() for l in full_text.split("\n") if l.strip()]

    # --- Extract registration number ---
    reg_number = None
    reg_patterns = [
        r'\b\d{12,14}(?:\s*-\s*\d{4,7})?\b',       # new format: 201901012345 or 201901012345-12345
        r'\b\d{5,7}\s*-\s*[A-Z]\b',                  # old format: 123456-A
        r'(?i)(?:no\.?\s*(?:pendaftaran|registration|syarikat|company))\s*[:\-]?\s*([\w\d\s\-]+)',
    ]
    for pat in reg_patterns:
        m = re.search(pat, full_text)
        if m:
            reg_number = m.group(0).strip() if m.lastindex is None or m.lastindex == 0 else m.group(1).strip()
            break

    # --- Extract company name ---
    company_name = None
    suffix_pattern = re.compile(r'\b(?:SDN\.?\s*BHD\.?|BHD\.?|BERHAD|ENTERPRISE|TRADING|INDUSTRIES|SERVICES|MARKETING|CORPORATION|HOLDINGS|GROUP|LLP|PLT)\b', re.IGNORECASE)
    
    for i, line in enumerate(lines):
        # 1. Label based
        label_match = re.search(r'(?i)(?:nama\s*(?:syarikat|perniagaan)|company\s*name|business\s*name|name\s*of\s*(?:company|business))\s*[:\-]?\s*(.*)', line)
        if label_match:
            candidate = label_match.group(1).strip()
            if candidate and len(candidate) > 2:
                company_name = candidate
                break
            elif i + 1 < len(lines):
                company_name = lines[i+1].strip()
                break
                
        # 2. "under the name" or "underthe name"
        under_name = re.search(r'(?i)under\s*the\s*name\s+(.+)', line) or re.search(r'(?i)underthe\s*name\s+(.+)', line)
        if under_name:
            company_name = under_name.group(1).strip()
            break
            
        # 3. Suffix based (if line is relatively short)
        if suffix_pattern.search(line):
            if len(line.split()) <= 8:
                company_name = line.strip()
                break

    return {
        "company_name": company_name, 
        "registration_number": reg_number,
        "extracted_text_preview": full_text[:200]  # Optional debug field
    }

# ==========================================
# PAYMENT SETTINGS & WEBHOOK (DYNAMIC QR)
# ==========================================
from pydantic import BaseModel
import razorpay
import hmac
import hashlib

class PaymentSettingsIn(BaseModel):
    razorpay_key: Optional[str] = None
    razorpay_secret: Optional[str] = None
    webhook_secret: Optional[str] = None

@app.get("/api/admin/payment_settings")
def get_payment_settings(
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role not in ["SupremeAdmin", "SuperAdmin", "Admin"]: # Admin here acts like SuperAdmin usually
        raise HTTPException(status_code=403, detail="Not authorized")
    
    MASK = "\u2022" * 8
    if user.role == "SupremeAdmin":
        keys = get_supreme_keys(db) or {}
        return {
            "razorpay_key": keys.get("key_id", "") or "",
            "razorpay_secret": MASK if keys.get("key_secret") else "",
            "webhook_secret": MASK if keys.get("webhook_secret") else "",
        }

    owner_id = str(user.id) if user.role in ["SuperAdmin", "Admin"] else str(user.branch_id)
    settings = db.query(models.PaymentSettings).filter(models.PaymentSettings.owner_id == owner_id).first()
    # Fallback to check if it was previously saved with branch_id for SuperAdmin
    if not settings and user.role in ["SuperAdmin", "Admin"] and user.branch_id:
        settings = db.query(models.PaymentSettings).filter(models.PaymentSettings.owner_id == str(user.branch_id)).first()

    if not settings:
        return {"razorpay_key": "", "razorpay_secret": "", "webhook_secret": ""}
    return {
        "razorpay_key": settings.razorpay_key or "",
        "razorpay_secret": MASK if settings.razorpay_secret else "",
        "webhook_secret": MASK if settings.webhook_secret else "",
    }

@app.post("/api/admin/payment_settings")
def save_payment_settings(
    data: PaymentSettingsIn,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role not in ["SupremeAdmin", "SuperAdmin", "Admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # SupremeAdmin keys MUST go to the "razorpay_global" setting: that is the ONLY
    # place the SUBSCRIPTION payment flow reads from. Saving them to
    # PaymentSettings(owner_id="SUPREME") writes them where nothing looks, which
    # makes the stored keys impossible to update from the UI.
    if user.role == "SupremeAdmin":
        keys = get_supreme_keys(db) or {}
        if data.razorpay_key:
            keys["key_id"] = data.razorpay_key
        if data.razorpay_secret:
            enc = encrypt_secret(data.razorpay_secret)
            keys["key_secret"] = enc.get("key_secret", "")
            keys["iv"] = enc.get("iv", "")
            keys["encrypted"] = enc.get("encrypted", False)
        if data.webhook_secret:
            enc = encrypt_secret(data.webhook_secret)
            keys["webhook_secret"] = enc.get("key_secret", "")
            keys["webhook_iv"] = enc.get("iv", "")
            keys["webhook_encrypted"] = enc.get("encrypted", False)
        _set_setting(db, "razorpay_global", keys)
        return {"message": "Payment settings saved successfully"}

    owner_id = str(user.id) if user.role in ["SuperAdmin", "Admin"] else str(user.branch_id)
    settings = db.query(models.PaymentSettings).filter(models.PaymentSettings.owner_id == owner_id).first()
    if not settings:
        settings = models.PaymentSettings(
            owner_id=owner_id,
            role=user.role,
        )
        db.add(settings)

    if data.razorpay_key:
        settings.razorpay_key = data.razorpay_key
    if data.razorpay_secret:
        settings.razorpay_secret = json.dumps(encrypt_secret(data.razorpay_secret))
    if data.webhook_secret:
        settings.webhook_secret = json.dumps(encrypt_secret(data.webhook_secret))
    db.commit()
    return {"message": "Payment settings saved successfully"}

import urllib.parse

@app.post("/api/payment/razorpay/create_qr")
async def create_razorpay_qr(
    amount: float,
    reference_id: str,
    payment_type: str = "subscription",  # 'subscription' or 'invoice'
    branch_id: Optional[str] = None,
    currency: str = "MYR",
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    # Supreme settings for subscription payments (registration + upgrade)
    # Branch settings for invoice payments (washer/customer checkout)
    if payment_type == "subscription":
        keys = get_supreme_keys(db)
        user_role = None
        user_id = None
        if authorization:
            try:
                user = get_current_user(authorization, db)
                if user:
                    user_id = user.id
                    user_role = user.role
            except: pass
        sub_branch_id = None
        if not user_id and reference_id:
            user = db.query(models.User).filter((models.User.branch_id == reference_id) | (models.User.tracking_id == reference_id)).first()
            if user:
                user_id = user.id
                user_role = user.role
        try:
            if user_id:
                _u = db.query(models.User).filter(models.User.id == user_id).first()
                if _u:
                    sub_branch_id = _u.branch_id
        except Exception:
            sub_branch_id = None
        owner_id = "SUPREME"
    else:
        # Invoice payments require auth to resolve the branch
        user = get_current_user(authorization, db)
        bid = branch_id or user.branch_id
        keys = get_branch_razorpay_keys(db, bid, user.id)
        user_role = user.role
        user_id = user.id
        owner_id = bid
    
    key_id = keys.get("key_id", "")
    key_secret = resolve_key_secret(keys)
    if not key_id or not key_secret:
        raise HTTPException(status_code=400, detail="Razorpay is not configured. Please set up payment gateway keys in Payment Settings.")
        
    client = razorpay.Client(auth=(key_id, key_secret))

    try:
        import urllib.parse, time, uuid
        order_amount = int(amount * 100)

        order_number = reference_id
        if payment_type == "invoice":
            order_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
        else:
            # Frontend polls GET /api/payment/subscription/status/{order_id}, which
            # looks up SubscriptionOrder.order_number, and the webhook only acts on
            # "SUB-" order numbers. Without a SUB- order + row, polling 404s forever
            # and payment is never confirmed.
            order_number = f"SUB-{uuid.uuid4().hex[:8].upper()}"

        notes = {
            "type": payment_type,
            "reference_id": reference_id,
            "order_number": order_number,
            "branch_id": owner_id,
        }
        if payment_type == "invoice" and user_id:
            notes["washer_id"] = user_id
            notes["job_id"] = reference_id

        # Razorpay's QR Codes API issues a UPI QR, and UPI settles in INR only.
        # For INR try the native QR first (Razorpay verifies it directly).
        if str(currency).upper() == "INR":
            try:
                order = client.order.create(data={
                    "amount": order_amount,
                    "currency": currency,
                    "receipt": reference_id,
                    "notes": notes,
                })
                qr_response = client.qrcode.create(data={
                    "type": "upi_qr",
                    "name": f"Payment for {reference_id}",
                    "usage": "single_use",
                    "fixed_amount": True,
                    "payment_amount": order_amount,
                    "description": f"Payment for {reference_id}",
                    "notes": dict(notes, order_id=order["id"]),
                })
                qr_url = qr_response.get("image_url", "")
                if qr_url:
                    db.add(models.Payment(
                        amount=amount, role=user_role or "global", owner_id=owner_id or "global",
                        qr_id=qr_response.get("id"), status="PENDING",
                        meta_data={"job_id": reference_id, "washer_id": user_id, "user_id": user_id,
                                   "type": payment_type, "order_number": order_number},
                    ))
                    if payment_type != "invoice":
                        db.add(models.SubscriptionOrder(
                            order_number=order_number, branch_id=sub_branch_id,
                            plan_id=reference_id, amount=amount, status="PENDING",
                            razorpay_order_id=order["id"], razorpay_qr_id=qr_response.get("id"),
                        ))
                    db.commit()
                    return {"order_id": order_number if payment_type != "invoice" else order["id"],
                            "qr_url": qr_url, "amount": amount,
                            "key": key_id, "order_number": order_number}
            except Exception as e:
                # Smart Collect / QR Codes not enabled on this account -> fall through.
                print("Native UPI QR unavailable, using payment link:", e)

        # Payment Link works for EVERY currency (MYR included) and needs no
        # Smart Collect activation. The QR image simply encodes the link.
        pl_response = client.payment_link.create({
            "amount": order_amount,
            "currency": currency,
            "accept_partial": False,
            "description": f"Payment for {reference_id}",
            "reference_id": f"{order_number}_{int(time.time())}",
            "notes": notes,
        })
        short_url = pl_response.get("short_url")
        pl_id = pl_response.get("id")
        qr_url = (
            "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data="
            + urllib.parse.quote(short_url)
            + "&color=0a1020&bgcolor=ffffff"
        )

        db.add(models.Payment(
            amount=amount, role=user_role or "global", owner_id=owner_id or "global",
            qr_id=pl_id, status="PENDING",
            meta_data={"job_id": reference_id, "washer_id": user_id, "user_id": user_id,
                       "short_url": short_url, "type": payment_type, "order_number": order_number},
        ))
        if payment_type != "invoice":
            db.add(models.SubscriptionOrder(
                order_number=order_number, branch_id=sub_branch_id,
                plan_id=reference_id, amount=amount, status="PENDING",
                razorpay_qr_id=pl_id,
            ))
        db.commit()

        return {"order_id": pl_id,
                "qr_url": qr_url, "amount": amount,
                "key": key_id, "order_number": order_number, "payment_url": short_url}

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        print(f"Razorpay Error: {error_msg}")
        if "Authentication failed" in error_msg or "unauthorized" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Invalid Razorpay Keys. Please check Payment Gateway Settings.")
        raise HTTPException(status_code=500, detail=f"Razorpay Error: {error_msg}")

from fastapi import Request

@app.post("/api/webhook/razorpay")
async def razorpay_webhook_v2(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("x-razorpay-signature")
    
    if not signature:
        raise HTTPException(status_code=400, detail="Missing signature")
        
    payload_json = json.loads(body)
    event = payload_json.get("event")

    # qr_code.credited is the event Razorpay fires specifically for native UPI QR
    # payments (client.qrcode.create(...) path). Without it, INR subscription
    # payments made via the dynamic QR have no way to ever reach PAID status.
    if event not in ["payment.captured", "payment.authorized", "order.paid",
                      "payment_link.paid", "payment_link.completed", "qr_code.credited"]:
        return {"status": "ignored"}

    payload = payload_json.get("payload", {})
    payment_entity = payload.get("payment", {}).get("entity", {}) or {}
    payment_link_entity = payload.get("payment_link", {}).get("entity", {}) or {}
    order_entity = payload.get("order", {}).get("entity", {}) or {}
    qr_code_entity = payload.get("qr_code", {}).get("entity", {}) or {}

    # Notes usually live on the payment entity, but for a qr_code.credited event
    # they may only be present on the qr_code entity itself.
    notes = (payment_entity.get("notes") or payment_link_entity.get("notes")
             or order_entity.get("notes") or qr_code_entity.get("notes") or {})

    payment_type = notes.get("type")
    reference_id = notes.get("reference_id")
    order_number_from_notes = notes.get("order_number")
    payment_link_id = payment_link_entity.get("id")
    qr_code_id = qr_code_entity.get("id")
    payment_id = payment_entity.get("id")

    if not reference_id and not order_number_from_notes and not qr_code_id:
        return {"status": "no reference id"}

    owner_id = "SUPREME" if payment_type == "subscription" else None
    
    # If it's an invoice, we need to find the branch_id to verify the signature properly
    if payment_type == "invoice":
        # Find session or job
        job = db.query(models.PendingJob).filter(models.PendingJob.id == reference_id).first()
        if job:
            owner_id = job.branch_id
            
    if not owner_id:
        # Try to find the settings that match this webhook
        pass # To properly verify we need the webhook secret

    webhook_secret_plain = None
    if owner_id == "SUPREME":
        settings = get_supreme_keys(db)
        if settings and settings.get("webhook_secret"):
            webhook_secret_plain = resolve_webhook_secret(settings)
    elif owner_id:
        settings = get_branch_razorpay_keys(db, owner_id)
        if settings and settings.get("webhook_secret"):
            webhook_secret_plain = resolve_webhook_secret(settings)
        
    if not webhook_secret_plain:
        return {"status": "webhook secret not found"}
        
    # Verify signature
    expected_sig = hmac.new(
        webhook_secret_plain.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(expected_sig, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Mark as paid
    if payment_type == "subscription":
        # Use order_number_from_notes if available, else fallback to reference_id.
        lookup_id = order_number_from_notes if order_number_from_notes else reference_id
        order = db.query(models.SubscriptionOrder).filter(
            (models.SubscriptionOrder.order_number == lookup_id) |
            (models.SubscriptionOrder.razorpay_qr_id == payment_link_id) |
            (models.SubscriptionOrder.razorpay_qr_id == qr_code_id) |
            (models.SubscriptionOrder.razorpay_payment_id == payment_id)
        ).first()
        if order:
            order.status = "PAID"
            order.paid_at = datetime.utcnow()
            if payment_id:
                order.razorpay_payment_id = payment_id
            if payment_link_id and not order.razorpay_qr_id:
                order.razorpay_qr_id = payment_link_id
            elif qr_code_id and not order.razorpay_qr_id:
                order.razorpay_qr_id = qr_code_id

            branch = db.query(models.Branch).filter(models.Branch.id == order.branch_id).first()
            if branch:
                branch.subscription = order.plan_id
                plan = db.query(models.SubscriptionPlan).filter(models.SubscriptionPlan.id == order.plan_id).first()
                months = 12 if (plan and "annual" in plan.duration.lower()) else 1
                now = datetime.utcnow()
                branch.expiry_date = (now + timedelta(days=30*months)).strftime("%d/%m/%Y")

            tx = db.query(models.SubscriptionTransaction).filter(
                models.SubscriptionTransaction.branch_id == order.branch_id,
                models.SubscriptionTransaction.status.in_(["Pending", "pending", "Pending Approval", "pending approval"])
            ).order_by(models.SubscriptionTransaction.created_at.desc()).first()
            if tx:
                tx.status = "Verified"
                tx.payment_date = datetime.utcnow().strftime("%d %b %Y, %I:%M %p")
                if payment_id:
                    tx.transaction_id = payment_id

            db.commit()
            await manager.broadcast_event("subscription_paid", {"order_number": order.order_number})
            
    elif payment_type == "invoice":
        job = db.query(models.PendingJob).filter(models.PendingJob.id == reference_id).first()
        if job:
            job.status = "paid"
            db.commit()
            
        payment = None
        if order_number_from_notes:
            for p in db.query(models.Payment).filter_by(status="PENDING").all():
                if p.meta_data and p.meta_data.get("order_number") == order_number_from_notes:
                    payment = p
                    break
                    
        if not payment and (payment_link_id or qr_code_id):
            for p in db.query(models.Payment).filter_by(status="PENDING").all():
                if p.qr_id in (payment_link_id, qr_code_id):
                    payment = p
                    break
        if payment:
            payment.status = "SUCCESS"
            payment.payment_id = payment_entity.get("id")
            db.commit()
            
        if job:
            await manager.broadcast_event("invoice_paid", {"job_id": reference_id}, branch_id=job.branch_id)
            
    return {"status": "success"}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)

try:
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:
    pass
from fastapi import APIRouter
from sqlalchemy import text
from database import engine
import main

@main.app.get('/api/fix-currency')
def fix_currency():
    with engine.connect() as conn:
        try:
            conn.execute(text('ALTER TABLE subscription_transactions ADD COLUMN currency VARCHAR(10) DEFAULT ''MYR'''))
            conn.commit()
            return 'Added currency column'
        except Exception as e:
            return str(e)
@main.app.get('/api/fix-currency2')
def fix_currency2():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE subscription_transactions ADD COLUMN currency VARCHAR(10) DEFAULT 'MYR'"))
            conn.commit()
            return 'Added currency column'
        except Exception as e:
            return str(e)

@app.get("/api/settings/currency-rates")
def get_currency_rates(db: Session = Depends(get_db)):
    setting = db.query(models.Setting).filter(models.Setting.key == "currency_rates").first()
    if setting and setting.value:
        try:
            return json.loads(setting.value)
        except:
            return {}
    return {}

@app.put("/api/settings/currency-rates")
def set_currency_rates(data: dict, db: Session = Depends(get_db)):
    setting = db.query(models.Setting).filter(models.Setting.key == "currency_rates").first()
    if not setting:
        setting = models.Setting(key="currency_rates", value=json.dumps(data))
        db.add(setting)
    else:
        setting.value = json.dumps(data)
    db.commit()
    return {"status": "success"}
