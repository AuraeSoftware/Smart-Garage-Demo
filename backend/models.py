from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, Boolean
from sqlalchemy.sql import func
from database import Base


class Setting(Base):
    """Key-value store: qr_label, loyalty config, counters."""
    __tablename__ = "settings"
    key   = Column(String, primary_key=True)
    value = Column(Text, nullable=False, default="")


class User(Base):
    __tablename__ = "users"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    username       = Column(String(100), unique=True, index=True, nullable=False)
    password_hash  = Column(String(200), nullable=False)
    plain_password = Column(String(200), nullable=True)
    role           = Column(String(50), default="Washer")
    name           = Column(String(150))
    phone          = Column(String(30), nullable=True)
    email          = Column(String(200), nullable=True)
    status         = Column(String(20), default="Active")
    avatar         = Column(String(5), nullable=True)
    branch_id      = Column(String(50), nullable=True)
    joined         = Column(String(20), nullable=True)
    # Individual user vehicle info
    vehicle_plate  = Column(String(50), nullable=True)
    vehicle_make   = Column(String(100), nullable=True)
    vehicle_model  = Column(String(100), nullable=True)
    subscription   = Column(String(30), nullable=True, default="trial")
    tracking_id    = Column(String(100), nullable=True)
    payment_info   = Column(JSON, nullable=True)
    reset_code     = Column(String(10), nullable=True)
    reset_code_expiry = Column(DateTime, nullable=True)
    created_at     = Column(DateTime, server_default=func.now())


class Branch(Base):
    __tablename__ = "branches"
    id         = Column(String(50), primary_key=True)
    owner_id   = Column(Integer, nullable=True) # Super Admin / Franchisee ID
    name       = Column(String(200), nullable=False)
    address    = Column(String(300))
    phone      = Column(String(30), nullable=True)
    manager    = Column(String(150), nullable=True)
    status     = Column(String(20), default="Active")
    subscription = Column(String(30), default="trial")
    created_at = Column(String(30), nullable=True)
    expiry_date = Column(String(30), nullable=True)
    company_reg_no = Column(String(100), nullable=True)


class Package(Base):
    __tablename__ = "packages"
    id         = Column(String(50), primary_key=True)
    name       = Column(String(150), nullable=False)
    desc       = Column(String(300))
    price      = Column(Float, default=0)
    time       = Column(String(30))
    color      = Column(String(20), default="#22d3ee")
    sort_order = Column(Integer, default=0)
    products   = Column(Text, nullable=True)
    branch_id  = Column(String(50), nullable=True)


class Session(Base):
    """Completed invoice / wash session."""
    __tablename__ = "sessions"
    id             = Column(String(20), primary_key=True)   # INV-CAR001
    date           = Column(String(50))
    washer_id      = Column(Integer)
    washer         = Column(String(150))
    washer_username= Column(String(100), nullable=True)
    branch_id      = Column(String(50), nullable=True)
    branch         = Column(String(200), nullable=True)
    location       = Column(String(100), nullable=True)
    location_name  = Column(String(300), nullable=True)
    lat            = Column(Float, default=0)
    lng            = Column(Float, default=0)
    vehicle        = Column(JSON)
    customer       = Column(JSON)
    package        = Column(JSON)
    payment        = Column(JSON)
    coupon         = Column(JSON, nullable=True)
    products       = Column(JSON, nullable=True)
    original_total = Column(Float, default=0)
    total          = Column(Float, default=0)
    status         = Column(String(30), default="Completed")
    created_at     = Column(DateTime, server_default=func.now())


class PendingJob(Base):
    """Submitted intake job awaiting payment."""
    __tablename__ = "pending_jobs"
    id            = Column(String(30), primary_key=True)
    customer      = Column(JSON)
    vehicle       = Column(JSON)
    package       = Column(JSON)
    products      = Column(JSON, nullable=True)
    geo           = Column(JSON, nullable=True)
    location_name = Column(String(300), nullable=True)
    branch_id     = Column(String(50))
    branch        = Column(String(200), nullable=True)
    washer_id     = Column(Integer)
    washer        = Column(String(150))
    loyalty       = Column(JSON, nullable=True)
    submitted_at  = Column(DateTime, server_default=func.now())
    status        = Column(String(20), default="pending")


class CustomerJobRequest(Base):
    """Public job request submitted by a customer."""
    __tablename__ = "customer_job_requests"
    id              = Column(String(30), primary_key=True)   # REQ-1234
    tracking_id     = Column(String(50), unique=True, index=True)
    customer_name   = Column(String(150))
    customer_phone  = Column(String(30))
    address         = Column(String(300), nullable=True)
    branch_id       = Column(String(50))
    status          = Column(String(20), default="Pending")  # Pending, Assigned, Completed
    package_id      = Column(String(50), nullable=True)      # Selected package
    assigned_job_id = Column(String(30), nullable=True)      # Links to PendingJob
    created_at      = Column(DateTime, server_default=func.now())


class Customer(Base):
    __tablename__ = "customers"
    id               = Column(String(20), primary_key=True)   # CUS-001
    username         = Column(String(100), unique=True, index=True, nullable=True)
    password_hash    = Column(String(200), nullable=True)
    name             = Column(String(150))
    phone            = Column(String(30), unique=True, index=True)
    email            = Column(String(200), nullable=True)
    branch_id        = Column(String(50), nullable=True)
    total_spend      = Column(Float, default=0)
    last_visit       = Column(String(50), nullable=True)
    joined_at        = Column(DateTime, server_default=func.now())
    notes            = Column(Text, default="")
    coupons_redeemed = Column(Integer, default=0)
    last_coupon_used = Column(DateTime, nullable=True)
    visits           = Column(JSON, default=list)
    coupon_history   = Column(JSON, default=list)


class Product(Base):
    __tablename__ = "products"
    id          = Column(String(50), primary_key=True)
    name        = Column(String(150), nullable=False)
    desc        = Column(String(300), default="")
    size        = Column(String(50), nullable=True)
    price       = Column(Float, default=0.0)
    unit_cost   = Column(Float, default=0.0)
    qty_per_unit = Column(Integer, default=1)
    clicks      = Column(Integer, default=1)
    barcode     = Column(String(100), nullable=True)
    branch_id   = Column(String(50), nullable=True)
    created_at  = Column(DateTime, server_default=func.now())


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id          = Column(String(50), primary_key=True)
    name        = Column(String(150), nullable=False)
    category    = Column(String(100), nullable=False)
    quantity    = Column(Float, default=0.0)
    threshold   = Column(Float, default=3.0)
    description = Column(String(300), default="")
    price       = Column(Float, default=0.0)
    cost        = Column(Float, default=0.0)
    barcode     = Column(String(100), nullable=True)
    branch_id   = Column(String(50), nullable=True)
    is_active   = Column(Boolean, default=True)
    washes_per_unit = Column(Integer, default=1)
    used_washes = Column(Integer, default=0)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())


class InventoryHistory(Base):
    __tablename__ = "inventory_history"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    item_id         = Column(String(50), nullable=False)
    event_type      = Column(String(50), nullable=False)  # 'stock_in' or 'stock_out'
    quantity_change = Column(Float, nullable=False)
    created_by      = Column(String(150), nullable=True)
    created_at      = Column(DateTime, server_default=func.now())


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    id          = Column(String(50), primary_key=True)
    label       = Column(String(100), nullable=False)
    price       = Column(String(50), nullable=False)
    monthly_price = Column(Float, nullable=True)
    annual_price = Column(Float, nullable=True)
    price_inr   = Column(String(50), nullable=True)
    monthly_price_inr = Column(Float, nullable=True)
    annual_price_inr = Column(Float, nullable=True)
    duration    = Column(String(50), nullable=False)
    color       = Column(String(20), default="#6366f1")
    features    = Column(JSON, default=list)
    max_washers = Column(Integer, nullable=True)
    max_sessions = Column(Integer, nullable=True)
    max_branches = Column(Integer, nullable=True)
    has_loyalty = Column(Boolean, default=False)

    has_reports = Column(Boolean, default=False)
    report_access = Column(String(50), default="All")
    has_ai_scanning = Column(Boolean, default=False)
    has_multiple_branches = Column(Boolean, default=False)
    has_payment_gateway = Column(Boolean, default=False)


class SubscriptionTransaction(Base):
    __tablename__ = "subscription_transactions"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    user_id        = Column(Integer, nullable=True)
    user_name      = Column(String(150), nullable=True)
    branch_id      = Column(String(50), nullable=True)
    branch_name    = Column(String(200), nullable=True)
    plan_id        = Column(String(50), nullable=True)
    plan_name      = Column(String(100), nullable=True)
    amount         = Column(Float, default=0.0)
    currency       = Column(String(10), default="MYR")
    transaction_id = Column(String(100), nullable=True)
    payment_date   = Column(String(50), nullable=True)
    status         = Column(String(20), default="Verified")
    created_at     = Column(DateTime, server_default=func.now())


class SubscriptionOrder(Base):
    __tablename__ = "subscription_orders"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    order_number        = Column(String(50), unique=True, index=True)
    branch_id           = Column(String(50), nullable=True)
    plan_id             = Column(String(50), nullable=True)
    amount              = Column(Float, default=0.0)
    razorpay_order_id   = Column(String(255), nullable=True)
    razorpay_payment_id = Column(String(255), nullable=True)
    razorpay_qr_id      = Column(String(255), nullable=True)
    status              = Column(String(20), default="PENDING")
    paid_at             = Column(DateTime, nullable=True)
    created_at          = Column(DateTime, server_default=func.now())

class PaymentSettings(Base):
    __tablename__ = "payment_settings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(String(50), nullable=True) # Could be branch_id or user_id or "SUPREME"
    role = Column(String(50), nullable=False) # 'SupremeAdmin', 'SuperAdmin', 'BranchAdmin'
    razorpay_key = Column(String(255), nullable=True)
    razorpay_secret = Column(String(255), nullable=True)
    webhook_secret = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    amount = Column(Float, default=0.0)
    role = Column(String(50), nullable=False)
    owner_id = Column(String(50), nullable=False)
    qr_id = Column(String(255), nullable=True)
    order_id = Column(String(255), nullable=True)
    payment_id = Column(String(255), nullable=True)
    status = Column(String(20), default="PENDING")
    meta_data = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    super_admin_id = Column(String(50), nullable=False)
    plan_id = Column(String(50), nullable=False)
    start_date = Column(DateTime, nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    status = Column(String(20), default="ACTIVE")
    created_at = Column(DateTime, server_default=func.now())
