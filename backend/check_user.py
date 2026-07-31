import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models # assuming we're in the backend directory

engine = create_engine(os.getenv("DATABASE_URL", "postgresql+pg8000://postgres:root1234@washpro.cfssy0qowr14.ap-southeast-2.rds.amazonaws.com:5432/washpro"))
Session = sessionmaker(bind=engine)
db = Session()

users = db.query(models.User).filter(models.User.username.like('%xxxx%')).all()
for u in users:
    print(f"User: {u.username}, Role: {u.role}, Status: {u.status}, Suspended: {getattr(u, 'is_locked', False)}")
