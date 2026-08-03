import { initCalendar, teardownCalendar } from "./calendar.js";
import { initNotes, teardownNotes, filterNotes } from "./notes.js";
import { initChatbot } from "./chatbot.js";

// ---------- Toasts (exported for other modules) ----------
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = "opacity .3s ease";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ---------- Boot modules once a user is signed in ----------
let booted = false;

document.addEventListener("auth-changed", (e) => {
  const user = e.detail.user;
  if (user && !booted) {
    booted = true;
    initCalendar(user.uid);
    initNotes(user.uid);
    initChatbot(user.uid);
  } else if (!user && booted) {
    booted = false;
    teardownCalendar();
    teardownNotes();
  }
});

// ---------- Panel tabs (Notes / AI Assistant) ----------
document.querySelectorAll(".panel-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".panel-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel-body").forEach((b) => b.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.panel}`).classList.add("active");
  });
});

// ---------- Search: filters both calendar events (handled in calendar.js)
// and the notes list ----------
document.getElementById("search-input")?.addEventListener("input", (e) => {
  filterNotes(e.target.value);
});

// ---------- Mobile dock: switch between calendar / notes+chat panel ----------
const dock = document.getElementById("mobile-dock");
const sidePanel = document.getElementById("side-panel");

dock?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-target]");
  if (!btn) return;
  dock.querySelectorAll("button[data-target]").forEach((b) => b.classList.remove("dock-active"));
  btn.classList.add("dock-active");

  const target = btn.dataset.target;
  if (target === "calendar-view") {
    sidePanel.classList.remove("open");
  } else if (target === "notes-view") {
    sidePanel.classList.add("open");
    document.querySelector('.panel-tab[data-panel="notes"]').click();
  } else if (target === "chat-view") {
    sidePanel.classList.add("open");
    document.querySelector('.panel-tab[data-panel="chat"]').click();
  }
});
