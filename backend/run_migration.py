from app.database import engine
from app.models import MarketPrice

# Drop the old table
print("Dropping market_prices table...")
MarketPrice.__table__.drop(engine, checkfirst=True)

# Create the new table
print("Creating market_prices table...")
MarketPrice.__table__.create(engine)

print("Migration completed successfully.")
