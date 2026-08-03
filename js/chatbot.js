import { getEventsSnapshot, aiCreateEvent, aiUpdateEvent, aiDeleteEvent } from "./calendar.js";
import { showToast } from "./app.js";

const messagesEl = document.getElementById("chat-messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");

let currentUid = null;
let history = []; // [{role: 'user'|'model', text: string}]

export function initChatbot(uid) {
  currentUid = uid;
  history = [];
  form.addEventListener("submit", handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addMessage("user", text);
  history.push({ role: "user", text });
  input.value = "";

  const thinkingEl = addThinking();

  try {
    const context = buildContext();
    const res = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history, context })
    });

    if (!res.ok) throw new Error(`Assistant error (${res.status})`);
    const data = await res.json();

    thinkingEl.remove();
    addMessage("ai", data.reply || "…");
    history.push({ role: "model", text: data.reply || "" });

    if (Array.isArray(data.actions) && data.actions.length) {
      await runActions(data.actions);
    }
  } catch (err) {
    thinkingEl.remove();
    addMessage("ai", "Sorry, I couldn't reach the assistant right now. Please try again.");
    showToast(err.message, "error");
  }
}

function buildContext() {
  // Give the model a compact snapshot of upcoming events so it can
  // resolve references like "move my dentist appointment".
  const now = new Date();
  const upcoming = getEventsSnapshot()
    .filter((e) => {
      const end = e.end ? new Date(e.end) : null;
      return !end || end >= now;
    })
    .slice(0, 40)
    .map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end, category: e.category }));

  return {
    now: now.toISOString(),
    timezoneOffsetMinutes: now.getTimezoneOffset(),
    upcomingEvents: upcoming
  };
}

async function runActions(actions) {
  for (const action of actions) {
    try {
      if (action.type === "create_event") {
        await aiCreateEvent(currentUid, {
          title: action.title,
          start: action.start,
          end: action.end,
          allDay: !!action.allDay,
          category: action.category || "other",
          description: action.description || ""
        });
        showToast(`Added "${action.title}" to your calendar`, "success");
      } else if (action.type === "update_event" && action.eventId) {
        await aiUpdateEvent(currentUid, action.eventId, action.patch || {});
        showToast("Event updated by Aurora AI", "success");
      } else if (action.type === "delete_event" && action.eventId) {
        await aiDeleteEvent(currentUid, action.eventId);
        showToast("Event removed by Aurora AI", "info");
      }
    } catch (err) {
      showToast(`Couldn't apply AI action: ${err.message}`, "error");
    }
  }
}

function addMessage(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `chat-msg chat-${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrap;
}

function addThinking() {
  const wrap = document.createElement("div");
  wrap.className = "chat-msg chat-ai thinking";
  wrap.innerHTML = `<div class="bubble"><span></span><span></span><span></span></div>`;
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return wrap;
}
