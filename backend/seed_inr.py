from dotenv import load_dotenv
load_dotenv()
from database import SessionLocal
import models

def seed_inr_prices():
    db = SessionLocal()
    plans = db.query(models.SubscriptionPlan).all()
    for plan in plans:
        # Default fallback logic for seeding INR values
        # e.g., RM 149 = ~INR 2499
        if not plan.price_inr:
            plan.price_inr = f"INR {plan.monthly_price * 20 if plan.monthly_price else 1999}"
        if plan.monthly_price and not plan.monthly_price_inr:
            plan.monthly_price_inr = plan.monthly_price * 20
        if plan.annual_price and not plan.annual_price_inr:
            plan.annual_price_inr = plan.annual_price * 20
        
        # specific seeding for known plans if needed
        if 'start' in plan.label.lower():
            plan.price_inr = "INR 1499"
            plan.monthly_price_inr = 1499
            plan.annual_price_inr = 14990
        elif 'grow' in plan.label.lower():
            plan.price_inr = "INR 2999"
            plan.monthly_price_inr = 2999
            plan.annual_price_inr = 29990
        elif 'pro' in plan.label.lower():
            plan.price_inr = "INR 4499"
            plan.monthly_price_inr = 4499
            plan.annual_price_inr = 44990
        elif 'elite' in plan.label.lower():
            plan.price_inr = "INR 7999"
            plan.monthly_price_inr = 7999
            plan.annual_price_inr = 79990
        elif 'free' in plan.label.lower():
            plan.price_inr = "INR 0"
            plan.monthly_price_inr = 0
            plan.annual_price_inr = 0

    db.commit()
    print("INR prices seeded successfully!")

if __name__ == "__main__":
    seed_inr_prices()
