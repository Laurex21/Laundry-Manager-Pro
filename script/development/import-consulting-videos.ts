import { readFileSync } from "node:fs";
import pg from "pg";
import { themes } from "../../server/lib/consulting-course-catalogue";
import { secureDatabaseConfig } from "../../server/lib/database-tls";

const url = new URL(process.env.DATABASE_URL || "");
if (process.env.NODE_ENV !== "development" || process.env.REPLIT_DEPLOYMENT ||
    url.hostname !== "helium" || url.pathname !== "/heliumdb") {
  throw new Error("La base de développement Replit est requise.");
}
const mappings = JSON.parse(readFileSync(0, "utf8")) as Record<string, string>;
const lessonIds = themes.flatMap(theme => theme.lessons.map(lesson => lesson.id));
if (Object.keys(mappings).length !== lessonIds.length ||
    !lessonIds.every(key => Object.hasOwn(mappings,key) && typeof mappings[key] === "string" && /^[A-Za-z0-9_-]{11}$/.test(mappings[key]))) {
  throw new Error("Les destinations doivent correspondre au catalogue complet.");
}
const client = new pg.Client(secureDatabaseConfig(process.env));
await client.connect();
try {
  await client.query("BEGIN");
  for (const id of lessonIds) {
    await client.query(`INSERT INTO consulting_pilot_videos (module_id, youtube_id) VALUES ($1,$2)
      ON CONFLICT (module_id) DO UPDATE SET youtube_id=excluded.youtube_id`, [id, mappings[id]]);
  }
  await client.query("COMMIT");
  console.log(lessonIds.length + " destinations configurées.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
