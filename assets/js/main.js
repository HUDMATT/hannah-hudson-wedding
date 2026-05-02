const HNW = window.HNW || {};

HNW.storage = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

HNW.demoGuests = [
  {
    id: "g-101",
    household: "Martini Family",
    name: "Lena Martini",
    phone: "555-0101",
    email: "lena@example.com",
    address: "123 Placeholder Lane, City, ST",
    plusOnes: 2,
    tags: "family, rehearsal",
    code: "FALL101",
    members: ["Lena Martini", "Marco Martini", "Sofia Martini"]
  },
  {
    id: "g-102",
    household: "Matthews Friends",
    name: "Jordan Blake",
    phone: "555-0102",
    email: "jordan@example.com",
    address: "456 Sample Street, City, ST",
    plusOnes: 1,
    tags: "friends",
    code: "FALL102",
    members: ["Jordan Blake", "Taylor Reed"]
  },
  {
    id: "g-103",
    household: "Avery Household",
    name: "Morgan Avery",
    phone: "555-0103",
    email: "morgan@example.com",
    address: "789 Autumn Road, City, ST",
    plusOnes: 0,
    tags: "coworkers",
    code: "FALL103",
    members: ["Morgan Avery"]
  }
];

HNW.ensureGuests = function ensureGuests() {
  const guests = HNW.storage.get("hnwGuests", null);
  if (!guests || !Array.isArray(guests) || guests.length === 0) {
    HNW.storage.set("hnwGuests", HNW.demoGuests);
    return HNW.demoGuests;
  }
  return guests;
};

function initNavigation() {
  const toggle = document.querySelector(".nav__toggle");
  const menu = document.querySelector(".nav__menu");
  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      menu.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function initLightbox() {
  const lightbox = document.querySelector("#lightbox");
  if (!lightbox) return;

  const image = lightbox.querySelector(".lightbox__image");
  const title = lightbox.querySelector("#lightbox-title");
  const close = lightbox.querySelector(".lightbox__close");

  document.querySelectorAll(".gallery-item").forEach((item) => {
    item.addEventListener("click", () => {
      image.className = `lightbox__image ${Array.from(item.classList).filter((name) => name.startsWith("photo-card--")).join(" ")}`;
      title.textContent = item.dataset.title || "Photo placeholder";
      lightbox.hidden = false;
      close.focus();
    });
  });

  const closeLightbox = () => {
    lightbox.hidden = true;
  };
  close.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !lightbox.hidden) closeLightbox();
  });
}

function initCountdown() {
  const countdown = document.querySelector("[data-countdown]");
  if (!countdown) return;

  const targetDate = new Date(countdown.dataset.countdown);
  const daysEl = countdown.querySelector("[data-countdown-days]");
  const hoursEl = countdown.querySelector("[data-countdown-hours]");
  const minutesEl = countdown.querySelector("[data-countdown-minutes]");
  const secondsEl = countdown.querySelector("[data-countdown-seconds]");

  const pad = (value) => String(value).padStart(2, "0");

  function updateCountdown() {
    const remaining = Math.max(targetDate.getTime() - Date.now(), 0);
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    daysEl.textContent = String(days).padStart(3, "0");
    hoursEl.textContent = pad(hours);
    minutesEl.textContent = pad(minutes);
    secondsEl.textContent = pad(seconds);

    if (remaining === 0) {
      countdown.setAttribute("aria-label", "The wedding day is here");
    }
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
}

function initGuestInfoForm() {
  const form = document.querySelector("#guest-info-form");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code") || "";
  const codeInput = document.querySelector("#info-code");
  const note = document.querySelector("#guest-code-note");
  const confirmation = document.querySelector("#guest-info-confirmation");

  if (code) {
    codeInput.value = code;
    note.textContent = `Invite code ${code} was detected from the link.`;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const record = {
      code: codeInput.value.trim(),
      name: document.querySelector("#info-name").value.trim(),
      phone: document.querySelector("#info-phone").value.trim(),
      email: document.querySelector("#info-email").value.trim(),
      address: document.querySelector("#info-address").value.trim(),
      household: document.querySelector("#info-household").value.trim(),
      notes: document.querySelector("#info-notes").value.trim(),
      updatedAt: new Date().toISOString()
    };

    // TODO: Send guest info updates to the backend instead of localStorage.
    const updates = HNW.storage.get("hnwGuestInfoUpdates", []);
    updates.push(record);
    HNW.storage.set("hnwGuestInfoUpdates", updates);
    confirmation.textContent = "Thank you. Your guest information has been saved locally for now.";
    confirmation.classList.remove("hidden");
    form.reset();
    codeInput.value = record.code;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  HNW.ensureGuests();
  initNavigation();
  initLightbox();
  initCountdown();
  initGuestInfoForm();
});

window.HNW = HNW;
