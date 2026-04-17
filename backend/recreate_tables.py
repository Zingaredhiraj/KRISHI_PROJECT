from app.database import engine
from app.models import MarketPrice, GovernmentScheme

# Drop the old tables
print("Dropping tables...")
MarketPrice.__table__.drop(engine, checkfirst=True)
GovernmentScheme.__table__.drop(engine, checkfirst=True)

# Create the new tables
print("Creating tables...")
MarketPrice.__table__.create(engine)
GovernmentScheme.__table__.create(engine)

print("Migration completed successfully.")
