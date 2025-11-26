// testSync.js - Place this in backend/scripts/
// Manual test script to trigger guest database sync

import { manualSync } from "./syncGuestDatabase.js";

console.log("🧪 Testing Guest Database Sync\n");
console.log("=".repeat(50));

manualSync()
  .then((result) => {
    if (result.success) {
      console.log("=".repeat(50));
      console.log("✅ TEST PASSED - Database synced successfully");
      console.log(`📦 Size: ${result.size} MB`);
      console.log("=".repeat(50));
    } else {
      console.log("=".repeat(50));
      console.log("❌ TEST FAILED");
      console.log(`Error: ${result.error}`);
      console.log("=".repeat(50));
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });
