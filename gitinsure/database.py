import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./giginsure.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Worker(Base):
    __tablename__ = "workers"
    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String, nullable=False)
    phone           = Column(String, unique=True, index=True, nullable=False)
    password_hash   = Column(String, nullable=False)
    platform        = Column(String)
    pincode         = Column(Integer)
    city            = Column(String)
    vehicle         = Column(String)
    daily_income    = Column(Float, default=500.0)
    zone_risk_score = Column(Float, default=55.0)
    tenure_days     = Column(Integer, default=0)
    created_at      = Column(DateTime, default=datetime.utcnow)


class Policy(Base):
    __tablename__ = "policies"
    id           = Column(Integer, primary_key=True, index=True)
    worker_id    = Column(Integer, nullable=False)
    plan         = Column(String)
    premium_paid = Column(Float)
    coverage_cap = Column(Float)
    max_hours    = Column(Integer)
    start_date   = Column(DateTime, default=datetime.utcnow)
    end_date     = Column(DateTime)
    status       = Column(String, default="active")


class Claim(Base):
    __tablename__ = "claims"
    id            = Column(Integer, primary_key=True, index=True)
    policy_id     = Column(Integer)
    worker_id     = Column(Integer)
    trigger_type  = Column(String)
    trigger_value = Column(Float)
    fraud_score   = Column(Float)
    decision      = Column(String)
    payout_amount = Column(Float, default=0)
    status        = Column(String, default="pending")
    initiated_at  = Column(DateTime, default=datetime.utcnow)
    resolved_at   = Column(DateTime, nullable=True)


class TriggerLog(Base):
    __tablename__ = "trigger_logs"
    id           = Column(Integer, primary_key=True, index=True)
    pincode      = Column(Integer)
    trigger_type = Column(String)
    value        = Column(Float)
    threshold    = Column(Float)
    fired        = Column(Boolean, default=False)
    source       = Column(String, default="api")
    detected_at  = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    print("Database initialized")


if __name__ == "__main__":
    init_db()
