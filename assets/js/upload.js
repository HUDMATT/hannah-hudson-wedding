(function () {
  const form = document.querySelector("#guest-upload-form");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const eventCodeInput = document.querySelector("#upload-event-code");
  const warning = document.querySelector("#upload-code-warning");
  const confirmation = document.querySelector("#upload-confirmation");
  const photosInput = document.querySelector("#upload-photos");
  const turnstileWrap = document.querySelector("#turnstile-widget");
  let turnstileWidgetId = null;

  function setMessage(message, isError = false) {
    confirmation.textContent = message;
    confirmation.classList.remove("hidden");
    confirmation.style.borderLeftColor = isError ? "var(--color-terracotta)" : "var(--color-evergreen)";
  }

  function jpgNameFor(file, index) {
    const baseName = String(file.name || `wedding-photo-${index + 1}`)
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "") || `wedding-photo-${index + 1}`;
    return `${baseName}.jpg`;
  }

  async function imageBitmapFor(file) {
    if ("createImageBitmap" in window) {
      return createImageBitmap(file, { imageOrientation: "from-image" });
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Image could not be decoded."));
      };
      image.src = url;
    });
  }

  async function convertToJpeg(file, index) {
    const bitmap = await imageBitmapFor(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    if (typeof bitmap.close === "function") bitmap.close();

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) throw new Error("Image could not be converted to JPG.");

    return new File([blob], jpgNameFor(file, index), {
      type: "image/jpeg",
      lastModified: Date.now()
    });
  }

  async function loadConfig() {
    const eventCode = params.get("event") || params.get("code") || "";
    eventCodeInput.value = eventCode;
    if (!eventCode) {
      warning.textContent = "This upload page needs the QR code link from the wedding venue.";
      warning.classList.remove("hidden");
    }

    try {
      const config = await HNW.apiJson("/api/public/upload-config");
      if (config.turnstileSiteKey) {
        turnstileWrap.classList.remove("hidden");
        const renderWhenReady = () => {
          if (!window.turnstile) {
            window.setTimeout(renderWhenReady, 100);
            return;
          }
          turnstileWidgetId = window.turnstile.render("#turnstile-widget", {
            sitekey: config.turnstileSiteKey
          });
        };
        renderWhenReady();
      }
    } catch {
      warning.textContent = "Upload verification could not load. Please refresh before uploading.";
      warning.classList.remove("hidden");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector("button[type='submit']");
    const files = Array.from(photosInput.files || []);

    if (!eventCodeInput.value) {
      setMessage("Please use the QR code link from the venue to upload photos.", true);
      return;
    }
    if (!files.length) {
      setMessage("Please choose at least one photo.", true);
      return;
    }
    if (files.length > 5) {
      setMessage("Please upload 5 images or fewer at a time.", true);
      return;
    }
    if (files.some((file) => file.size > 8 * 1024 * 1024)) {
      setMessage("Each image should be 8 MB or smaller.", true);
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Converting...";

    try {
      const convertedFiles = [];
      for (const [index, file] of files.entries()) {
        convertedFiles.push(await convertToJpeg(file, index));
      }

      const formData = new FormData();
      formData.append("eventCode", eventCodeInput.value);
      formData.append("uploadedByName", document.querySelector("#upload-name").value.trim());
      formData.append("caption", document.querySelector("#upload-caption").value.trim());
      const turnstileResponse = form.querySelector('[name="cf-turnstile-response"]');
      if (turnstileResponse) formData.append("cf-turnstile-response", turnstileResponse.value);
      convertedFiles.forEach((file) => formData.append("photos", file));

      submitButton.textContent = "Uploading...";
      const response = await fetch("/api/public/photo-upload", {
        method: "POST",
        credentials: "same-origin",
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Upload failed.");

      setMessage(`Thank you. ${data.count} photo${data.count === 1 ? "" : "s"} uploaded for review.`);
      form.reset();
      eventCodeInput.value = params.get("event") || params.get("code") || "";
      if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
    } catch (err) {
      setMessage(err.message || "We could not convert and upload those photos. Please try again.", true);
      if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Upload Photos";
    }
  });

  loadConfig();
})();
