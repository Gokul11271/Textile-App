const database = require('./electron/database.cjs');

async function verify() {
  try {
    await database.initDatabase();
    const info = await database.dbAll("PRAGMA table_info(parties)");
    const names = info.map(c => c.name);
    console.log('COLUMNS:', names.join(', '));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
verify();
