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
    members: [
      { name: "Lena Martini", type: "adult" },
      { name: "Marco Martini", type: "adult" },
      { name: "Sofia Martini", type: "child" }
    ]
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
    members: [
      { name: "Jordan Blake", type: "adult" },
      { name: "Taylor Reed", type: "adult" }
    ]
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
    members: [
      { name: "Morgan Avery", type: "adult" }
    ]
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
  const knownInfo = document.querySelector("#known-info");
  const allInfoComplete = document.querySelector("#all-info-complete");
  const nameInput = document.querySelector("#info-name");
  const phoneInput = document.querySelector("#info-phone");
  const emailInput = document.querySelector("#info-email");
  const addressInput = document.querySelector("#info-address");
  const householdInput = document.querySelector("#info-household");

  const escapeHTML = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

  const getMembers = (guest) => {
    const members = guest && guest.members && guest.members.length ? guest.members : [];
    return members.map((member) => typeof member === "string" ? member : member.name).filter(Boolean);
  };

  const findGuestByCode = (inviteCode) => HNW.ensureGuests().find((guest) => (
    String(guest.code || "").toLowerCase() === String(inviteCode || "").toLowerCase()
  ));

  const setFieldVisibility = (id, value, requiredWhenVisible = false) => {
    const wrapper = document.querySelector(`#${id}-wrap`);
    const input = document.querySelector(`#${id}`);
    const hasValue = Boolean(String(value || "").trim());
    if (!wrapper || !input) return hasValue;
    input.value = value || "";
    wrapper.classList.toggle("hidden", hasValue);
    input.required = !hasValue && requiredWhenVisible;
    return hasValue;
  };

  if (code) {
    codeInput.value = code;
    const guest = findGuestByCode(code);
    const householdMembers = getMembers(guest).join("\n");

    note.textContent = guest
      ? `We found your household using invite code ${code}. Please complete only the missing details below.`
      : `Invite code ${code} was detected. Please complete the details below.`;

    if (guest) {
      const completeFields = [
        ["Name", guest.name],
        ["Phone", guest.phone],
        ["Email", guest.email],
        ["Mailing address", guest.address],
        ["Household members", householdMembers]
      ].filter((field) => String(field[1] || "").trim());

      if (completeFields.length) {
        knownInfo.innerHTML = `<p class="kicker">Already on file</p><ul>${completeFields.map(([label, value]) => `<li><strong>${label}:</strong> ${escapeHTML(value).replace(/\n/g, ", ")}</li>`).join("")}</ul>`;
        knownInfo.classList.remove("hidden");
      }

      const fieldStatus = [
        setFieldVisibility("info-name", guest.name, true),
        setFieldVisibility("info-phone", guest.phone, true),
        setFieldVisibility("info-email", guest.email, true),
        setFieldVisibility("info-address", guest.address, true),
        setFieldVisibility("info-household", householdMembers, true)
      ];

      if (fieldStatus.every(Boolean)) {
        allInfoComplete.classList.remove("hidden");
      }
    } else {
      nameInput.required = true;
    }
  } else {
    note.textContent = "Please complete the details below. If you were sent a personalized link, the invite code should appear automatically.";
    nameInput.required = true;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const currentGuest = findGuestByCode(codeInput.value.trim());
    const record = {
      code: codeInput.value.trim(),
      name: nameInput.value.trim() || (currentGuest && currentGuest.name) || "",
      phone: phoneInput.value.trim() || (currentGuest && currentGuest.phone) || "",
      email: emailInput.value.trim() || (currentGuest && currentGuest.email) || "",
      address: addressInput.value.trim() || (currentGuest && currentGuest.address) || "",
      household: householdInput.value.trim() || getMembers(currentGuest).join("\n"),
      notes: "",
      updatedAt: new Date().toISOString()
    };

    // TODO: Send guest info updates to the backend instead of localStorage.
    const updates = HNW.storage.get("hnwGuestInfoUpdates", []);
    updates.push(record);
    HNW.storage.set("hnwGuestInfoUpdates", updates);

    const guests = HNW.storage.get("hnwGuests", []);
    const guestIndex = guests.findIndex((guest) => String(guest.code || "").toLowerCase() === record.code.toLowerCase());
    if (guestIndex >= 0) {
      const householdWasVisible = !document.querySelector("#info-household-wrap").classList.contains("hidden");
      guests[guestIndex] = {
        ...guests[guestIndex],
        name: record.name || guests[guestIndex].name,
        phone: record.phone || guests[guestIndex].phone,
        email: record.email || guests[guestIndex].email,
        address: record.address || guests[guestIndex].address,
        members: householdWasVisible && record.household
          ? record.household.split(/\n|,/).map((name) => name.trim()).filter(Boolean).map((name) => ({ name, type: "adult" }))
          : guests[guestIndex].members
      };
      HNW.storage.set("hnwGuests", guests);
    }

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
