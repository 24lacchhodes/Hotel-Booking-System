const $ = (selector) => document.querySelector(selector);
const roomGrid = $("#roomGrid");
const bookingRows = $("#bookingRows");
let roomsCache = [];
let toastTimer;

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}
function prettyDate(value) {
  if (!value) return "—";
  return new Date(value + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3300);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed. Please try again.");
  return data;
}
function setDateMinimums() {
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  ["#checkIn", "#checkOut", "#modalCheckIn", "#modalCheckOut"].forEach(s => $(s).min = localToday);
  $("#checkIn").value ||= localToday;
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  $("#checkOut").value ||= new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $("#modalCheckIn").value = $("#checkIn").value;
  $("#modalCheckOut").value = $("#checkOut").value;
}
function roomImage(room) {
  const photos = {
    Standard: "photo-1611892440504-42a792e24d32",
    Deluxe: "photo-1611892440504-42a792e24d32",
    Executive: "photo-1590490360182-c33d57733427",
    Suite: "photo-1578683010236-d716f9a3f461"
  };
  return `https://images.unsplash.com/${photos[room.type] || photos.Standard}?auto=format&fit=crop&w=900&q=80`;
}
function roomDescription(room) {
  return room.description || "A thoughtfully designed space with everything you need to feel at home.";
}
function renderRooms(rooms) {
  roomsCache = rooms;
  $("#roomCount").textContent = rooms.length;
  if (!rooms.length) {
    roomGrid.innerHTML = `<div class="no-results">No rooms match those dates just yet.<br><br><button class="btn btn-outline" id="clearSearch">Clear filters</button></div>`;
    $("#clearSearch").addEventListener("click", () => { $("#roomType").value = "All rooms"; loadRooms(false); });
    return;
  }
  roomGrid.innerHTML = rooms.map((room, index) => `
    <article class="room-card">
      <div class="room-image">
        <img src="${roomImage(room)}" alt="${room.type} hotel room" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=80'">
        <span class="room-tag">${room.type} room</span><button class="room-fav" aria-label="Room ${room.room_no} favourite" title="Lovely choice">♡</button>
      </div>
      <div class="room-body">
        <div class="room-meta"><span>ROOM ${escapeHtml(room.room_no)} · 2 GUESTS</span><span class="${room.current_status === "Occupied" ? "occupied" : "available"}">${room.current_status}</span></div>
        <h3>${escapeHtml(room.type)} ${room.type === "Suite" ? "sanctuary" : room.type === "Executive" ? "retreat" : room.type === "Deluxe" ? "comfort" : "essential"}</h3>
        <p>${escapeHtml(roomDescription(room))}</p>
        <div class="room-foot"><div class="price"><strong>${money(room.price)}</strong> <small>/ night</small></div>
          <button class="book-btn" data-book="${room.id}">Book this room ↗</button></div>
      </div>
    </article>`).join("");
  roomGrid.querySelectorAll("[data-book]").forEach(button => button.addEventListener("click", () => openBooking(Number(button.dataset.book))));
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
async function loadRooms(useDates = true) {
  roomGrid.innerHTML = '<div class="loading">Finding lovely places for you…</div>';
  try {
    const params = new URLSearchParams();
    const type = $("#roomType").value;
    if (type) params.set("type", type);
    if (useDates) {
      const checkIn = $("#checkIn").value, checkOut = $("#checkOut").value;
      if (checkIn && checkOut) {
        if (checkOut <= checkIn) throw new Error("Check-out must be after check-in.");
        params.set("checkIn", checkIn); params.set("checkOut", checkOut);
      }
    }
    renderRooms(await api(`/api/rooms?${params.toString()}`));
  } catch (error) {
    roomGrid.innerHTML = `<div class="no-results">${escapeHtml(error.message)}</div>`;
    showToast(error.message);
  }
}
async function loadStats() {
  try {
    const stats = await api("/api/stats");
    $("#statRooms").textContent = stats.rooms;
    $("#statBookings").textContent = stats.bookings;
    $("#statGuests").textContent = stats.guests;
  } catch { /* Stats are non-critical to the booking flow. */ }
}
async function loadBookings() {
  try {
    const bookings = await api("/api/bookings");
    if (!bookings.length) {
      bookingRows.innerHTML = '<tr><td colspan="6" class="empty-cell">No bookings yet — your next lovely stay can start here.</td></tr>';
      return;
    }
    bookingRows.innerHTML = bookings.map(b => `
      <tr>
        <td><div class="guest-cell"><span class="guest-avatar">${escapeHtml((b.guest_name || "?").trim().charAt(0).toUpperCase())}</span><div><strong>${escapeHtml(b.guest_name)}</strong><div style="font-size:9px;color:#92988f;margin-top:3px">${escapeHtml(b.email || "Guest")}</div></div></div></td>
        <td class="room-cell"><strong>Room ${escapeHtml(b.room_no)}</strong><small>${escapeHtml(b.type)}</small></td>
        <td>${prettyDate(b.check_in)}<br><span style="color:#9ba096;display:inline-block;margin-top:4px">to ${prettyDate(b.check_out)}</span></td>
        <td><strong>${money(b.price)}</strong></td>
        <td><span class="status-pill ${b.status === "Cancelled" ? "cancelled" : ""}">${escapeHtml(b.status)}</span></td>
        <td>${b.status === "Confirmed" ? `<button class="cancel-btn" data-cancel="${b.id}">Cancel</button>` : "—"}</td>
      </tr>`).join("");
    bookingRows.querySelectorAll("[data-cancel]").forEach(button => button.addEventListener("click", async () => {
      if (!confirm("Cancel this booking?")) return;
      try {
        await api(`/api/bookings/${button.dataset.cancel}`, { method: "DELETE" });
        showToast("Booking cancelled. The room is available for those dates again.");
        await Promise.all([loadBookings(), loadStats(), loadRooms()]);
      } catch (error) { showToast(error.message); }
    }));
  } catch (error) {
    bookingRows.innerHTML = `<tr><td colspan="6" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;
  }
}
function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}
function openBooking(roomId) {
  const room = roomsCache.find(r => r.id === roomId);
  if (!room) return;
  $("#bookingRoomId").value = room.id;
  $("#modalRoomInfo").textContent = `Room ${room.room_no} · ${room.type} · a lovely choice for your stay`;
  $("#modalPrice").textContent = `${money(room.price)} / night`;
  $("#modalCheckIn").value = $("#checkIn").value;
  $("#modalCheckOut").value = $("#checkOut").value;
  openModal("bookingModal");
}
$("#searchBtn").addEventListener("click", () => loadRooms(true));
$("#roomType").addEventListener("change", () => loadRooms(true));
$("#refreshBookings").addEventListener("click", () => { loadBookings(); showToast("Booking journal refreshed."); });
$("#addRoomBtn").addEventListener("click", () => openModal("addRoomModal"));
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => closeModal(button.dataset.close)));
document.querySelectorAll(".modal-backdrop").forEach(backdrop => backdrop.addEventListener("click", event => {
  if (event.target === backdrop) closeModal(backdrop.id);
}));
document.addEventListener("keydown", event => {
  if (event.key === "Escape") document.querySelectorAll(".modal-backdrop.open").forEach(m => closeModal(m.id));
});
$("#checkIn").addEventListener("change", () => {
  $("#checkOut").min = $("#checkIn").value;
  if ($("#checkOut").value <= $("#checkIn").value) {
    const date = new Date($("#checkIn").value + "T00:00:00"); date.setDate(date.getDate() + 1);
    $("#checkOut").value = date.toISOString().slice(0, 10);
  }
});
$("#bookingForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true; button.textContent = "Confirming your stay…";
  try {
    const booking = await api("/api/bookings", { method: "POST", body: JSON.stringify({
      room_id: Number($("#bookingRoomId").value), guest_name: $("#guestName").value,
      email: $("#guestEmail").value, check_in: $("#modalCheckIn").value, check_out: $("#modalCheckOut").value
    })});
    closeModal("bookingModal"); event.target.reset();
    showToast(`Lovely! Room ${booking.room_no} is booked for ${booking.guest_name}.`);
    await Promise.all([loadBookings(), loadStats(), loadRooms()]);
    $("#bookings").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { showToast(error.message); }
  finally { button.disabled = false; button.innerHTML = 'Confirm my booking <span>→</span>'; }
});
$("#addRoomForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true; button.textContent = "Adding room…";
  try {
    await api("/api/rooms", { method: "POST", body: JSON.stringify({
      room_no: $("#newRoomNo").value, type: $("#newRoomType").value,
      price: Number($("#newRoomPrice").value), description: $("#newRoomDescription").value
    })});
    closeModal("addRoomModal"); event.target.reset();
    showToast("New room added to your collection.");
    await Promise.all([loadRooms(), loadStats()]);
  } catch (error) { showToast(error.message); }
  finally { button.disabled = false; button.innerHTML = 'Add room to StayHaven <span>→</span>'; }
});
setDateMinimums();
Promise.all([loadRooms(), loadBookings(), loadStats()]);
