import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const googleProvider = new GoogleAuthProvider();

let isSignUpMode = false;

const authScreen = document.getElementById("auth-screen");
const appRoot = document.getElementById("app");
const authForm = document.getElementById("auth-form");
const authError = document.getElementById("auth-error");
const authSubmitBtn = document.getElementById("auth-submit");
const toggleBtn = document.getElementById("auth-toggle-btn");
const toggleText = document.getElementById("auth-toggle-text");
const googleBtn = document.getElementById("google-signin");
const signOutBtn = document.getElementById("sign-out-btn");
const userNameEl = document.getElementById("user-name");
const userAvatarEl = document.getElementById("user-avatar");

function setMode(signUp) {
  isSignUpMode = signUp;
  authSubmitBtn.textContent = signUp ? "Create account" : "Sign in";
  toggleText.textContent = signUp ? "Already have an account?" : "New here?";
  toggleBtn.textContent = signUp ? "Sign in" : "Create an account";
  authError.textContent = "";
}

toggleBtn?.addEventListener("click", () => setMode(!isSignUpMode));

authForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  authSubmitBtn.disabled = true;
  try {
    if (isSignUpMode) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    authError.textContent = friendlyAuthError(err.code);
  } finally {
    authSubmitBtn.disabled = false;
  }
});

googleBtn?.addEventListener("click", async () => {
  authError.textContent = "";
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    authError.textContent = friendlyAuthError(err.code);
  }
});

signOutBtn?.addEventListener("click", () => signOut(auth));

function friendlyAuthError(code) {
  const map = {
    "auth/invalid-email": "That email doesn't look right.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "An account already exists with that email.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/popup-closed-by-user": "Sign-in popup was closed."
  };
  return map[code] || "Something went wrong. Please try again.";
}

// Broadcast auth state to the rest of the app via a custom event,
// so other modules don't need a circular import.
export let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    authScreen.classList.add("hidden");
    appRoot.classList.remove("hidden");
    userNameEl.textContent = user.displayName || user.email;
    userAvatarEl.textContent = (user.displayName || user.email || "?").charAt(0).toUpperCase();
  } else {
    authScreen.classList.remove("hidden");
    appRoot.classList.add("hidden");
  }
  document.dispatchEvent(new CustomEvent("auth-changed", { detail: { user } }));
});
