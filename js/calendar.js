import { db } from "./firebase-config.js";
import {
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { showToast } from "./app.js";

let calendar = null;
let miniCal = null;
let unsubscribeEvents = null;
let allEvents = []; // cached raw docs {id, ...data}
let activeCategories = new Set(["work", "personal", "urgent", "other"]);
let searchTerm = "";

function eventsCol(uid) {
  return collection(db, "users", uid, "events");
}

export function initCalendar(uid) {
  const el = document.getElementById("calendar");
  calendar = new FullCalendar.Calendar(el, {
    initialView: "dayGridMonth",
    headerToolbar: false,
    height: "100%",
    editable: true,
    selectable: true,
    dayMaxEvents: 3,
    nowIndicator: true,
    select: (info) => openEventModal(null, info.start, info.end, info.allDay),
    eventClick: (info) => openEventModal(info.event.id),
    eventDrop: (info) => persistEventTimes(info.event),
    eventResize: (info) => persistEventTimes(info.event),
    datesSet: (info) => {
      document.getElementById("cal-title").textContent = info.view.title;
      syncViewButtons(info.view.type);
    }
  });
  calendar.render();

  const miniEl = document.getElementById("mini-cal");
  miniCal = new FullCalendar.Calendar(miniEl, {
    initialView: "dayGridMonth",
    headerToolbar: { left: "prev", center: "title", right: "next" },
    height: "auto",
    contentHeight: 240,
    dayMaxEvents: 0,
    dateClick: (info) => calendar.gotoDate(info.date)
  });
  miniCal.render();

  wireToolbar();
  wireEventModal(uid);
  wireFilters();
  wireSearch();
  listenToEvents(uid);
}

export function teardownCalendar() {
  if (unsubscribeEvents) unsubscribeEvents();
  if (calendar) { calendar.destroy(); calendar = null; }
  if (miniCal) { miniCal.destroy(); miniCal = null; }
  allEvents = [];
}

function listenToEvents(uid) {
  const q = query(eventsCol(uid));
  unsubscribeEvents = onSnapshot(q, (snap) => {
    allEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderEvents();
  }, (err) => showToast(err.message, "error"));
}

function renderEvents() {
  if (!calendar) return;
  calendar.removeAllEvents();
  const term = searchTerm.trim().toLowerCase();
  allEvents
    .filter((e) => activeCategories.has(e.category || "other"))
    .filter((e) => !term || (e.title || "").toLowerCase().includes(term) || (e.description || "").toLowerCase().includes(term))
    .forEach((e) => {
      calendar.addEvent({
        id: e.id,
        title: e.title,
        start: toDate(e.start),
        end: toDate(e.end),
        allDay: !!e.allDay,
        classNames: [`cat-${e.category || "other"}`]
      });
    });
}

function toDate(v) {
  if (!v) return null;
  return typeof v === "string" ? v : v.toDate ? v.toDate() : v;
}

function syncViewButtons(viewType) {
  document.querySelectorAll("#view-switch button").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === viewType);
  });
}

function wireToolbar() {
  document.querySelectorAll("#view-switch button").forEach((btn) => {
    btn.addEventListener("click", () => calendar.changeView(btn.dataset.view));
  });
  document.getElementById("cal-prev").addEventListener("click", () => calendar.prev());
  document.getElementById("cal-next").addEventListener("click", () => calendar.next());
  document.getElementById("cal-today").addEventListener("click", () => calendar.today());
}

function wireFilters() {
  document.querySelectorAll(".cat-filter").forEach((cb) => {
    cb.addEventListener("change", () => {
      activeCategories.clear();
      document.querySelectorAll(".cat-filter:checked").forEach((c) => activeCategories.add(c.value));
      renderEvents();
    });
  });
}

function wireSearch() {
  document.getElementById("search-input").addEventListener("input", (e) => {
    searchTerm = e.target.value;
    renderEvents();
  });
}

// ---------- Event modal (create / edit / delete) ----------
const modal = document.getElementById("event-modal");
const form = document.getElementById("event-form");
const titleField = document.getElementById("event-modal-title");
const deleteBtn = document.getElementById("event-delete-btn");
let currentUid = null;

function wireEventModal(uid) {
  currentUid = uid;
  document.getElementById("new-event-btn").addEventListener("click", () => openEventModal(null));
  document.getElementById("dock-new-event")?.addEventListener("click", () => openEventModal(null));
  document.getElementById("event-cancel-btn").addEventListener("click", closeEventModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeEventModal(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveEventFromForm();
  });

  deleteBtn.addEventListener("click", async () => {
    const id = document.getElementById("event-id").value;
    if (!id) return;
    if (!confirm("Delete this event?")) return;
    await deleteDoc(doc(db, "users", currentUid, "events", id));
    showToast("Event deleted", "info");
    closeEventModal();
  });
}

export function openEventModal(eventId, defaultStart, defaultEnd, allDay) {
  form.reset();
  document.getElementById("event-id").value = "";
  deleteBtn.classList.add("hidden");

  if (eventId) {
    const data = allEvents.find((e) => e.id === eventId);
    if (!data) return;
    titleField.textContent = "Edit event";
    document.getElementById("event-id").value = eventId;
    document.getElementById("event-title").value = data.title || "";
    document.getElementById("event-start").value = toLocalInput(toDate(data.start));
    document.getElementById("event-end").value = toLocalInput(toDate(data.end));
    document.getElementById("event-allday").checked = !!data.allDay;
    document.getElementById("event-category").value = data.category || "other";
    document.getElementById("event-desc").value = data.description || "";
    deleteBtn.classList.remove("hidden");
  } else {
    titleField.textContent = "New event";
    const start = defaultStart || new Date();
    const end = defaultEnd || new Date(start.getTime() + 60 * 60 * 1000);
    document.getElementById("event-start").value = toLocalInput(start);
    document.getElementById("event-end").value = toLocalInput(end);
    document.getElementById("event-allday").checked = !!allDay;
  }
  modal.classList.remove("hidden");
  document.getElementById("event-title").focus();
}

function closeEventModal() {
  modal.classList.add("hidden");
}

async function saveEventFromForm() {
  const id = document.getElementById("event-id").value;
  const payload = {
    title: document.getElementById("event-title").value.trim(),
    start: document.getElementById("event-start").value,
    end: document.getElementById("event-end").value,
    allDay: document.getElementById("event-allday").checked,
    category: document.getElementById("event-category").value,
    description: document.getElementById("event-desc").value.trim(),
    updatedAt: serverTimestamp()
  };
  if (!payload.title) return;

  try {
    if (id) {
      await updateDoc(doc(db, "users", currentUid, "events", id), payload);
      showToast("Event updated", "success");
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(eventsCol(currentUid), payload);
      showToast("Event created", "success");
    }
    closeEventModal();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function persistEventTimes(fcEvent) {
  try {
    await updateDoc(doc(db, "users", currentUid, "events", fcEvent.id), {
      start: fcEvent.start.toISOString(),
      end: (fcEvent.end || fcEvent.start).toISOString(),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    showToast(err.message, "error");
  }
}

function toLocalInput(date) {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------- Public API used by the AI chatbot (function-calling style) ----------
export async function aiCreateEvent(uid, { title, start, end, allDay = false, category = "other", description = "" }) {
  const ref = await addDoc(eventsCol(uid), {
    title, start, end, allDay, category, description,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function aiUpdateEvent(uid, eventId, patch) {
  await updateDoc(doc(db, "users", uid, "events", eventId), { ...patch, updatedAt: serverTimestamp() });
}

export async function aiDeleteEvent(uid, eventId) {
  await deleteDoc(doc(db, "users", uid, "events", eventId));
}

export function getEventsSnapshot() {
  return allEvents;
}
