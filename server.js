const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const db = new sqlite3.Database(path.join(__dirname, "hotel.db"));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err); else resolve({ id: this.lastID, changes: this.changes });
  });
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_no TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    price REAL NOT NULL CHECK(price >= 0),
    description TEXT DEFAULT '',
    image TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    guest_name TEXT NOT NULL,
    email TEXT DEFAULT '',
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Confirmed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(room_id) REFERENCES rooms(id)
  )`);
  db.get("SELECT COUNT(*) AS count FROM rooms", (err, row) => {
    if (!err && row.count === 0) {
      const seed = [
        ["101", "Deluxe", 4200, "A calm, beautifully finished room for a restful city escape.", "deluxe"],
        ["204", "Suite", 7800, "A spacious suite with thoughtful details and a little extra luxury.", "suite"],
        ["305", "Standard", 2900, "A warm, comfortable base for your next adventure.", "standard"],
        ["402", "Executive", 6100, "Elevated comfort with a dedicated work nook and premium touches.", "executive"],
        ["501", "Suite", 8900, "Our signature suite, designed for slow mornings and special stays.", "suite"],
        ["108", "Deluxe", 4600, "Soft textures, natural light, and room to unwind.", "deluxe"]
      ];
      const stmt = db.prepare("INSERT INTO rooms (room_no,type,price,description,image) VALUES (?,?,?,?,?)");
      seed.forEach(room => stmt.run(room));
      stmt.finalize();
    }
  });
});

function validDateRange(checkIn, checkOut) {
  return /^\d{4}-\d{2}-\d{2}$/.test(checkIn || "") &&
    /^\d{4}-\d{2}-\d{2}$/.test(checkOut || "") && checkOut > checkIn;
}
function asyncRoute(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch(err => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
  });
}

// List rooms and optionally filter by type and dates.
app.get("/api/rooms", asyncRoute(async (req, res) => {
  const { type, checkIn, checkOut } = req.query;
  let rooms = await all("SELECT * FROM rooms ORDER BY CAST(room_no AS INTEGER)");
  if (type && type !== "All rooms") rooms = rooms.filter(r => r.type === type);
  if (checkIn || checkOut) {
    if (!validDateRange(checkIn, checkOut)) {
      return res.status(400).json({ error: "Choose a valid check-in and check-out date." });
    }
    const booked = await all(
      `SELECT DISTINCT room_id FROM bookings
       WHERE status = 'Confirmed' AND check_in < ? AND check_out > ?`,
      [checkOut, checkIn]
    );
    const busy = new Set(booked.map(b => b.room_id));
    rooms = rooms.filter(r => !busy.has(r.id));
  }
  const today = new Date().toISOString().slice(0, 10);
  const active = await all(
    `SELECT DISTINCT room_id FROM bookings
     WHERE status = 'Confirmed' AND check_in <= ? AND check_out > ?`,
    [today, today]
  );
  const occupied = new Set(active.map(b => b.room_id));
  res.json(rooms.map(r => ({ ...r, current_status: occupied.has(r.id) ? "Occupied" : "Available" })));
}));

app.post("/api/rooms", asyncRoute(async (req, res) => {
  const { room_no, type, price, description = "", image = "" } = req.body;
  if (!String(room_no || "").trim() || !type || !Number.isFinite(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ error: "Room number, room type, and a valid price are required." });
  }
  try {
    const result = await run(
      "INSERT INTO rooms (room_no,type,price,description,image) VALUES (?,?,?,?,?)",
      [String(room_no).trim(), type, Number(price), description, image]
    );
    res.status(201).json(await get("SELECT * FROM rooms WHERE id = ?", [result.id]));
  } catch (err) {
    if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "That room number already exists." });
    throw err;
  }
}));

app.get("/api/bookings", asyncRoute(async (_req, res) => {
  const bookings = await all(
    `SELECT b.*, r.room_no, r.type, r.price
     FROM bookings b JOIN rooms r ON r.id = b.room_id
     ORDER BY b.created_at DESC`
  );
  res.json(bookings);
}));

app.post("/api/bookings", asyncRoute(async (req, res) => {
  const { room_id, guest_name, email = "", check_in, check_out } = req.body;
  if (!room_id || !String(guest_name || "").trim() || !validDateRange(check_in, check_out)) {
    return res.status(400).json({ error: "Enter a guest name and a valid check-in/check-out range." });
  }
  const room = await get("SELECT * FROM rooms WHERE id = ?", [room_id]);
  if (!room) return res.status(404).json({ error: "Room not found." });
  const conflict = await get(
    `SELECT id FROM bookings WHERE room_id = ? AND status = 'Confirmed'
     AND check_in < ? AND check_out > ?`,
    [room_id, check_out, check_in]
  );
  if (conflict) return res.status(409).json({ error: "This room is already booked for overlapping dates. Please choose another room or dates." });
  const result = await run(
    "INSERT INTO bookings (room_id,guest_name,email,check_in,check_out) VALUES (?,?,?,?,?)",
    [room_id, String(guest_name).trim(), String(email).trim(), check_in, check_out]
  );
  res.status(201).json(await get(
    `SELECT b.*, r.room_no, r.type, r.price FROM bookings b
     JOIN rooms r ON r.id = b.room_id WHERE b.id = ?`, [result.id]
  ));
}));

app.delete("/api/bookings/:id", asyncRoute(async (req, res) => {
  const booking = await get("SELECT * FROM bookings WHERE id = ?", [req.params.id]);
  if (!booking) return res.status(404).json({ error: "Booking not found." });
  if (booking.status === "Cancelled") return res.status(409).json({ error: "This booking is already cancelled." });
  await run("UPDATE bookings SET status = 'Cancelled' WHERE id = ?", [req.params.id]);
  res.json({ message: "Booking cancelled successfully." });
}));

app.get("/api/stats", asyncRoute(async (_req, res) => {
  const rooms = await get("SELECT COUNT(*) AS total FROM rooms");
  const bookings = await get("SELECT COUNT(*) AS total FROM bookings WHERE status = 'Confirmed'");
  const guests = await get("SELECT COUNT(DISTINCT guest_name) AS total FROM bookings WHERE status = 'Confirmed'");
  const today = new Date().toISOString().slice(0, 10);
  const occupied = await get(
    "SELECT COUNT(DISTINCT room_id) AS total FROM bookings WHERE status = 'Confirmed' AND check_in <= ? AND check_out > ?",
    [today, today]
  );
  res.json({ rooms: rooms.total, bookings: bookings.total, guests: guests.total, occupied: occupied.total });
}));

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`StayHaven is running at http://localhost:${PORT}`));
