"""
Seed default data. Uses upsert-by-username — safe on every deploy.

Role system:
  SupremeAdmin = full platform access (app owner — OS2 Studio)
  SuperAdmin   = branch admin (branch-scoped)
  Washer       = washer app only

PRODUCTION NOTE:
  - All demo/test users, branches, and packages have been removed.
  - Only the SupremeAdmin account is seeded on first boot.
  - Change the SupremeAdmin password immediately after first login.
  - Branches, packages, and other data are created via the admin dashboard.
"""
import json
from sqlalchemy import text
from auth import hash_password
from models import User, Branch, Package, Setting, SubscriptionPlan

# ── SupremeAdmin (OS2 Studio platform owner) ─────────────────
# IMPORTANT: Change this password on first login via the dashboard
DEFAULT_USERS = [
    dict(
        username="supremeadmin",
        password_hash=hash_password("supreme123"),
        role="SupremeAdmin",
        name="Supreme Admin",
        phone="0000000000",
        status="Active",
        avatar="SA",
        branch_id=None,
        joined="Jun 2026",
    ),
]

# ── Branches ─────────────────────────────────────────────────
# No demo branches — create via dashboard
DEFAULT_BRANCHES = []

# ── Wash Packages ────────────────────────────────────────────
# No demo packages — create via dashboard
DEFAULT_PACKAGES = []

# ── Subscription Plans ───────────────────────────────────────
DEFAULT_PLANS = [
    dict(id="trial", label="Smart Garage Free Trial", price="RM 0", monthly_price=0, annual_price=0, duration="14 days", color="#6366f1", features=[], max_branches=1, max_washers=0, max_sessions=0, has_loyalty=True, has_reports=True, has_ai_scanning=True, has_multiple_branches=True, has_payment_gateway=True),
    dict(id="start", label="Smart Garage Start", price="RM 149", monthly_price=149, annual_price=1490, duration="/month", color="#059669", features=[], max_branches=1, max_washers=5, max_sessions=100, has_loyalty=True, has_reports=True, has_ai_scanning=True, has_multiple_branches=False, has_payment_gateway=True),
    dict(id="grow", label="Smart Garage Grow", price="RM 349", monthly_price=349, annual_price=3490, duration="/month", color="#3b82f6", features=[], max_branches=3, max_washers=15, max_sessions=200, has_loyalty=True, has_reports=True, has_ai_scanning=True, has_multiple_branches=True, has_payment_gateway=True),
    dict(id="pro", label="Smart Garage Pro", price="RM 699", monthly_price=699, annual_price=6990, duration="/month", color="#8b5cf6", features=[], max_branches=10, max_washers=40, max_sessions=300, has_loyalty=True, has_reports=True, has_ai_scanning=True, has_multiple_branches=True, has_payment_gateway=True),
    dict(id="elite", label="Smart Garage Elite", price="RM 1499", monthly_price=1499, duration="/month", color="#d97706", features=[], max_branches=0, max_washers=0, max_sessions=0, has_loyalty=True, has_reports=True, has_ai_scanning=True, has_multiple_branches=True, has_payment_gateway=True),
]

# ── Loyalty Default Config ───────────────────────────────────
DEFAULT_LOYALTY = {
    "enabled": True,
    "visitThreshold": 3,
    "discountType": "percent",
    "discountValue": 10,
    "alertMessage": "Congratulations! You have earned a loyalty reward.",
    "couponPrefix": "WASH",
    "validityDays": 30,
}

DEFAULT_SETTINGS = [
    ("loyalty",     json.dumps(DEFAULT_LOYALTY)),
    ("inv_counter", "0"),
    ("cus_counter", "0"),
]


def seed(db):
    """Upsert all default data — idempotent, safe to run on every boot."""

    # Ensure washes_per_unit column exists in inventory_items
    try:
        db.execute(text("ALTER TABLE inventory_items ADD COLUMN washes_per_unit INTEGER DEFAULT 10"))
        db.commit()
        print("Migrated: Added washes_per_unit to inventory_items")
    except Exception:
        db.rollback()

    # Migrate old 'superadmin' username to SupremeAdmin role if exists
    try:
        os2 = db.query(User).filter(User.username == "superadmin").first()
        if os2 and os2.role != "SupremeAdmin":
            os2.role = "SupremeAdmin"
            db.commit()
            print("Migrated superadmin → SupremeAdmin")
    except Exception as e:
        print(f"Migration note: {e}")
        db.rollback()

    # Users — upsert by username (SupremeAdmin only)
    for u in DEFAULT_USERS:
        existing_user = db.query(User).filter(User.username == u["username"]).first()
        if not existing_user:
            db.add(User(**u))
            print(f"Seeded user: {u['username']}")
        elif u["role"] == "SupremeAdmin":
            # Keep status active but do NOT overwrite password on re-deploy
            # (admin may have changed it via dashboard)
            existing_user.status = "Active"

    # Branches — upsert by id
    for b in DEFAULT_BRANCHES:
        if not db.query(Branch).filter(Branch.id == b["id"]).first():
            db.add(Branch(**b))

    # Packages — upsert by id
    for p in DEFAULT_PACKAGES:
        if not db.query(Package).filter(Package.id == p["id"]).first():
            db.add(Package(**p))

    # Settings — upsert by key (only insert if not present, never overwrite)
    for key, value in DEFAULT_SETTINGS:
        if not db.query(Setting).filter(Setting.key == key).first():
            db.add(Setting(key=key, value=value))

    # Subscription Plans — upsert by id
    for pl in DEFAULT_PLANS:
        existing_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == pl["id"]).first()
        if not existing_plan:
            db.add(SubscriptionPlan(**pl))
        else:
            for k, v in pl.items():
                setattr(existing_plan, k, v)

    db.commit()
    print("Seed complete.")
