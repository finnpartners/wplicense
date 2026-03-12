import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db/schema";

async function main() {
  await db.delete(settingsTable);
  console.log("Settings cleared - they will be regenerated with the new encryption key");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
