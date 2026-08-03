import { db } from "./firebase-config.js";
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { showToast } from "./app.js";

let unsubscribeNotes = null;
let allNotes = [];
let currentUid = null;

function notesCol(uid) {
  return collection(db, "users", uid, "notes");
}

const listEl = document.getElementById("notes-list");
const modal = document.getElementById("note-modal");
const form = document.getElementById("note-form");
const deleteBtn = document.getElementById("note-delete-btn");

export function initNotes(uid) {
  currentUid = uid;
  wireModal();
  document.getElementById("new-note-btn").addEventListener("click", () => openNoteModal(null));

  const q = query(notesCol(uid), orderBy("updatedAt", "desc"));
  unsubscribeNotes = onSnapshot(q, (snap) => {
    allNotes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderNotes();
  }, (err) => showToast(err.message, "error"));
}

export function teardownNotes() {
  if (unsubscribeNotes) unsubscribeNotes();
  allNotes = [];
  if (listEl) listEl.innerHTML = "";
}

function renderNotes(filterTerm = "") {
  if (!listEl) return;
  const term = filterTerm.trim().toLowerCase();
  const items = allNotes.filter(
    (n) => !term || (n.title || "").toLowerCase().includes(term) || (n.content || "").toLowerCase().includes(term)
  );
  listEl.innerHTML = "";
  if (items.length === 0) {
    listEl.innerHTML = `<p style="color:var(--ink-3);font-size:13px;text-align:center;margin-top:20px;">No notes yet — jot something down.</p>`;
    return;
  }
  items.forEach((n) => {
    const card = document.createElement("div");
    card.className = "note-card";
    card.innerHTML = `<h4>${escapeHtml(n.title || "Untitled")}</h4><p>${escapeHtml(n.content || "")}</p>`;
    card.addEventListener("click", () => openNoteModal(n.id));
    listEl.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function wireModal() {
  document.getElementById("note-cancel-btn").addEventListener("click", closeNoteModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeNoteModal(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("note-id").value;
    const payload = {
      title: document.getElementById("note-title").value.trim(),
      content: document.getElementById("note-content").value.trim(),
      updatedAt: serverTimestamp()
    };
    if (!payload.title) return;
    try {
      if (id) {
        await updateDoc(doc(db, "users", currentUid, "notes", id), payload);
        showToast("Note updated", "success");
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(notesCol(currentUid), payload);
        showToast("Note saved", "success");
      }
      closeNoteModal();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  deleteBtn.addEventListener("click", async () => {
    const id = document.getElementById("note-id").value;
    if (!id) return;
    if (!confirm("Delete this note?")) return;
    await deleteDoc(doc(db, "users", currentUid, "notes", id));
    showToast("Note deleted", "info");
    closeNoteModal();
  });
}

function openNoteModal(noteId) {
  form.reset();
  document.getElementById("note-id").value = "";
  deleteBtn.classList.add("hidden");
  if (noteId) {
    const n = allNotes.find((x) => x.id === noteId);
    if (!n) return;
    document.getElementById("note-id").value = noteId;
    document.getElementById("note-title").value = n.title || "";
    document.getElementById("note-content").value = n.content || "";
    deleteBtn.classList.remove("hidden");
  }
  modal.classList.remove("hidden");
  document.getElementById("note-title").focus();
}

function closeNoteModal() {
  modal.classList.add("hidden");
}

export function filterNotes(term) {
  renderNotes(term);
}
