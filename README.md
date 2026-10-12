# Hotel-Booking-System
# StayHaven — Hotel Room Booking System

A polished full-stack hotel room booking project for VS Code, built with HTML, CSS, vanilla JavaScript, Node.js, Express, and SQLite.

## Features

- Responsive hotel landing page with room cards and date/type search
- Add room through a modal form
- Create bookings with guest details and check-in/check-out dates
- SQLite persistence (`hotel.db` is created automatically)
- REST APIs using JSON and Fetch
- Prevents overlapping confirmed bookings for the same room
- Booking journal with cancellation support
- Dashboard counts for rooms, confirmed bookings, and guests
- Validation and clear error messages for duplicate room numbers, invalid date ranges, unavailable rooms, and missing bookings
- Seeded sample rooms on first launch

## Run it in VS Code

1. Install **Node.js LTS** from https://nodejs.org if you don't already have it.
2. Extract this ZIP and open the `stayhaven_hotel_booking` folder in VS Code.
3. Open **Terminal → New Terminal**.
4. Install dependencies:

   ```bash
   npm install
   ```

5. Start the server:

   ```bash
   npm start
   ```

6. Open **http://localhost:3000** in your browser.

The first run creates `hotel.db` in the project folder and inserts sample rooms.

## REST API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/rooms` | List rooms |
| GET | `/api/rooms?type=Deluxe&checkIn=2026-10-20&checkOut=2026-10-22` | Filter rooms by type and availability |
| POST | `/api/rooms` | Add a room |
| GET | `/api/bookings` | List bookings |
| POST | `/api/bookings` | Create a booking |
| DELETE | `/api/bookings/:id` | Cancel a booking |
| GET | `/api/stats` | Dashboard totals |

### Example: create a room

```json
{
  "room_no": "602",
  "type": "Deluxe",
  "price": 4500,
  "description": "A bright room with a quiet reading corner."
}
```

### Example: create a booking

```json
{
  "room_id": 1,
  "guest_name": "Alex Morgan",
  "email": "alex@example.com",
  "check_in": "2026-10-20",
  "check_out": "2026-10-22"
}
```

## Project structure

```text
stayhaven_hotel_booking/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── package.json
├── server.js
└── README.md
```

## Notes

- Date ranges use the hotel convention: check-in is inclusive and check-out is exclusive. A guest checking out on a date does not block a new guest checking in that same date.
- This is an educational project, not a production reservation platform. A production deployment should add authentication/authorization for room management, CSRF/security hardening, rate limiting, stronger database transaction handling, email confirmations, and deployment configuration.
- Room photography uses remote Unsplash image URLs, so an internet connection is needed for those images. The application itself runs locally.
