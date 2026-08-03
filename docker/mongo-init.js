// MongoDB initialisation script
// Creates application user and indexes on first boot

db = db.getSiblingDB('aed_inspection');

db.createCollection('users');
db.createCollection('inspections');

// Indexes for common queries
db.inspections.createIndex({ inspectionId: 1 }, { unique: true });
db.inspections.createIndex({ sessionId: 1 });
db.inspections.createIndex({ inspector: 1, startedAt: -1 });
db.inspections.createIndex({ inspectionResult: 1, startedAt: -1 });
db.inspections.createIndex({ serialNumber: 1 });

db.users.createIndex({ email: 1 }, { unique: true });

print('MongoDB initialised for AED Inspection Platform');
