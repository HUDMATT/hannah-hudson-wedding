const HNW = window.HNW || {};

HNW.apiJson = async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
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
  if (lightbox.dataset.bound === "true") return;
  lightbox.dataset.bound = "true";

  const image = lightbox.querySelector(".lightbox__image");
  const title = lightbox.querySelector("#lightbox-title");
  const close = lightbox.querySelector(".lightbox__close");

  document.addEventListener("click", (event) => {
    const item = event.target.closest(".gallery-item");
    if (!item) return;
    const imageUrl = item.dataset.imageUrl;
    if (imageUrl) {
      image.className = "lightbox__image";
      image.style.backgroundImage = `url("${imageUrl.replaceAll('"', "%22")}")`;
      image.setAttribute("aria-label", item.dataset.alt || item.dataset.title || "Selected gallery photo");
    } else {
      image.style.backgroundImage = "";
      image.className = `lightbox__image ${Array.from(item.classList).filter((name) => name.startsWith("photo-card--")).join(" ")}`;
      image.setAttribute("aria-label", item.dataset.title || "Selected gallery placeholder");
    }
    title.textContent = item.dataset.title || "Photo placeholder";
    lightbox.hidden = false;
    close.focus();
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

function initGalleryFeed() {
  const sections = document.querySelectorAll("[data-gallery-section]");
  if (!sections.length) return;

  const escapeHTML = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

  sections.forEach(async (grid) => {
    const section = grid.dataset.gallerySection;
    try {
      const data = await HNW.apiJson(`/api/gallery/assets?section=${encodeURIComponent(section)}`);
      if (!data.assets || data.assets.length === 0) return;
      grid.innerHTML = data.assets.map((asset) => `
        <button class="gallery-item gallery-photo" type="button" data-image-url="${escapeHTML(asset.image_url)}" data-title="${escapeHTML(asset.title || "Wedding photo")}" data-alt="${escapeHTML(asset.alt_text || asset.title || "Wedding photo")}">
          <img src="${escapeHTML(asset.image_url)}" alt="${escapeHTML(asset.alt_text || asset.title || "Wedding photo")}" loading="lazy">
          <span>${escapeHTML(asset.title || "Wedding photo")}</span>
        </button>
      `).join("");
      initLightbox();
    } catch {
      // Keep the elegant placeholder cards if the gallery API is unavailable.
    }
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
  let currentHousehold = null;

  const escapeHTML = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

  const getMembers = (household) => {
    const members = household && household.guests && household.guests.length ? household.guests : [];
    return members.map((member) => member.full_name || member.name).filter(Boolean);
  };

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

  async function loadGuestInfo(inviteCode) {
    codeInput.value = inviteCode;
    if (!inviteCode) {
      note.textContent = "Please complete the details below. If you were sent a personalized link, the invite code should appear automatically.";
      nameInput.required = true;
      return;
    }

    try {
      const data = await HNW.apiJson(`/api/public/guest-info?code=${encodeURIComponent(inviteCode)}`);
      currentHousehold = data.household;
      const householdMembers = getMembers(currentHousehold).join("\n");

      note.textContent = `We found your household using invite code ${inviteCode}. Please complete only the missing details below.`;

      const completeFields = [
        ["Name", currentHousehold.primary_name],
        ["Phone", currentHousehold.phone],
        ["Email", currentHousehold.email],
        ["Mailing address", currentHousehold.mailing_address],
        ["Household members", householdMembers]
      ].filter((field) => String(field[1] || "").trim());

      if (completeFields.length) {
        knownInfo.innerHTML = `<p class="kicker">Already on file</p><ul>${completeFields.map(([label, value]) => `<li><strong>${label}:</strong> ${escapeHTML(value).replace(/\n/g, ", ")}</li>`).join("")}</ul>`;
        knownInfo.classList.remove("hidden");
      }

      const fieldStatus = [
        setFieldVisibility("info-name", currentHousehold.primary_name, true),
        setFieldVisibility("info-phone", currentHousehold.phone, true),
        setFieldVisibility("info-email", currentHousehold.email, true),
        setFieldVisibility("info-address", currentHousehold.mailing_address, true),
        setFieldVisibility("info-household", householdMembers, true)
      ];

      if (fieldStatus.every(Boolean)) {
        allInfoComplete.classList.remove("hidden");
      }
    } catch (err) {
      note.textContent = err.message || `Invite code ${inviteCode} was not found. Please confirm the link and try again.`;
      nameInput.required = true;
    }
  }

  loadGuestInfo(code);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector("button[type='submit']");
    const householdMembersVisible = !document.querySelector("#info-household-wrap").classList.contains("hidden");
    const record = {
      code: codeInput.value.trim(),
      name: nameInput.value.trim() || (currentHousehold && currentHousehold.primary_name) || "",
      phone: phoneInput.value.trim() || (currentHousehold && currentHousehold.phone) || "",
      email: emailInput.value.trim() || (currentHousehold && currentHousehold.email) || "",
      address: addressInput.value.trim() || (currentHousehold && currentHousehold.mailing_address) || "",
      householdMembers: householdMembersVisible ? householdInput.value.trim() : ""
    };

    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    try {
      await HNW.apiJson("/api/public/guest-info", {
        method: "POST",
        body: JSON.stringify(record)
      });
      confirmation.textContent = "Thank you. Your guest information has been saved.";
      confirmation.classList.remove("hidden");
      form.reset();
      codeInput.value = record.code;
      if (record.code) await loadGuestInfo(record.code);
    } catch (err) {
      confirmation.textContent = err.message || "We could not save your information. Please try again.";
      confirmation.classList.remove("hidden");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit Information";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initLightbox();
  initGalleryFeed();
  initCountdown();
  initGuestInfoForm();
});

window.HNW = HNW;
