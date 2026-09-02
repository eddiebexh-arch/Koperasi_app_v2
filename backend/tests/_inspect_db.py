import asyncio, os
from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

env = dotenv_values("/app/backend/.env")


async def main():
    db = AsyncIOMotorClient(env["MONGO_URL"])[env["DB_NAME"]]
    u = await db.users.find_one({"email": "admin@makekal.id"})
    print("hash prefix:", u["password_hash"][:7], "len", len(u["password_hash"]))
    print("users:", await db.users.count_documents({}))
    print("trips:", [t["local_id"] for t in await db.sales_trips.find().to_list(50)])
    print("purchase TEST leftovers:", [p["local_id"] for p in await db.purchase_transactions.find({"farmer_name": {"$regex": "TEST_"}}).to_list(50)])
    print("expense TEST leftovers:", [e["local_id"] for e in await db.operational_expenses.find({"description": {"$regex": "TEST_"}}).to_list(50)])
    print("farmers TEST:", [f["name"] for f in await db.farmers.find({"name": {"$regex": "TEST_"}}).to_list(50)])
    # cleanup leftovers created by tests
    await db.farmers.delete_many({"name": {"$regex": "TEST_"}})
    await db.purchase_transactions.delete_many({"farmer_name": {"$regex": "TEST_"}})
    await db.operational_expenses.delete_many({"description": {"$regex": "TEST_"}})
    await db.sales_trips.delete_many({"local_id": {"$regex": "^TRIP-[0-9A-F]{10}$"}})
    print("after cleanup trips:", [t["local_id"] for t in await db.sales_trips.find().to_list(50)])

asyncio.run(main())
