(() => {
  "use strict";

  const ALLOWED_TAGS = new Set([
    "A", "B", "BLOCKQUOTE", "BR", "CODE", "DIV", "EM", "H1", "H2", "H3",
    "H4", "H5", "H6", "HR", "I", "IMG", "LI", "OL", "P", "PRE", "S",
    "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TABLE", "TBODY", "TD", "TH",
    "THEAD", "TR", "U", "UL",
  ]);
  const ALLOWED_ATTRS = new Set(["alt", "colspan", "href", "rowspan", "src", "target", "title"]);
  const TEXT_PLACEHOLDER = "내용을 입력해 주세요";
  const HTML_PLACEHOLDER = "HTML 코드를 입력해 주세요";

  function safeUrl(value, image = false) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^(?:https?:|\/|\.\/|\.\.\/)/i.test(raw)) return raw;
    if (!image && /^(?:mailto:|tel:)/i.test(raw)) return raw;
    return "";
  }

  function sanitize(html) {
    const raw = String(html || "");
    const source = /<\/?[a-z][\s\S]*>/i.test(raw)
      ? raw
      : raw
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\r?\n/g, "<br>");
    const doc = new DOMParser().parseFromString(`<div>${source}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    [...root.querySelectorAll("*")].forEach((node) => {
      if (!ALLOWED_TAGS.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        return;
      }
      [...node.attributes].forEach((attr) => {
        if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) node.removeAttribute(attr.name);
      });
      if (node.hasAttribute("href")) {
        const href = safeUrl(node.getAttribute("href"));
        if (href) node.setAttribute("href", href);
        else node.removeAttribute("href");
      }
      if (node.hasAttribute("src")) {
        const src = safeUrl(node.getAttribute("src"), true);
        if (src) node.setAttribute("src", src);
        else node.removeAttribute("src");
      }
      if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
    return root.innerHTML;
  }

  function renderSafe(element, html) {
    if (!element) return;
    element.classList.add("html-content");
    element.innerHTML = sanitize(html);
  }

  function looksLikeHtml(value) {
    return /<\/?[a-z][\s\S]*>/i.test(String(value || ""));
  }

  function mount(textarea) {
    if (!textarea || textarea.dataset.htmlEditorMounted === "1") return null;
    textarea.dataset.htmlEditorMounted = "1";

    const defaultPlaceholder = textarea.getAttribute("placeholder") || TEXT_PLACEHOLDER;
    if (!textarea.getAttribute("placeholder") || /<h2|<p>|HTML/i.test(defaultPlaceholder)) {
      textarea.setAttribute("placeholder", TEXT_PLACEHOLDER);
    }

    const shell = document.createElement("div");
    shell.className = "html-editor is-text";
    const toolbar = document.createElement("div");
    toolbar.className = "html-editor__toolbar";
    toolbar.innerHTML = `
      <button type="button" class="is-active" data-html-mode="text">일반 작성</button>
      <button type="button" data-html-mode="source">HTML 코드</button>
      <button type="button" data-html-mode="preview">미리보기</button>`;
    const preview = document.createElement("div");
    preview.className = "html-editor__preview html-content";
    preview.hidden = true;

    textarea.parentNode.insertBefore(shell, textarea);
    shell.append(toolbar, textarea, preview);

    let mode = "text";

    function setMode(next) {
      mode = next === "source" || next === "preview" ? next : "text";
      const isPreview = mode === "preview";
      const isSource = mode === "source";
      textarea.hidden = isPreview;
      preview.hidden = !isPreview;
      shell.classList.toggle("is-text", mode === "text");
      shell.classList.toggle("is-source", isSource);
      shell.classList.toggle("is-preview", isPreview);
      toolbar.querySelectorAll("[data-html-mode]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.htmlMode === mode);
      });
      if (mode === "text") {
        textarea.setAttribute("placeholder", TEXT_PLACEHOLDER);
      } else if (isSource) {
        textarea.setAttribute("placeholder", HTML_PLACEHOLDER);
      }
      if (isPreview) {
        renderSafe(preview, textarea.value);
        if (!preview.textContent.trim() && !preview.querySelector("img")) {
          preview.innerHTML = '<p class="html-editor__empty">미리볼 내용이 없습니다.</p>';
        }
      }
    }

    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-html-mode]");
      if (button) setMode(button.dataset.htmlMode);
    });
    textarea.addEventListener("input", () => {
      if (mode === "preview") renderSafe(preview, textarea.value);
    });

    // 기본은 일반 작성. 기존 HTML이 들어 있는 수정 글만 HTML 코드 모드로 연다.
    setMode(looksLikeHtml(textarea.value) ? "source" : "text");

    return {
      setMode,
      getMode: () => mode,
      refresh: () => renderSafe(preview, textarea.value),
      reset: () => setMode("text"),
    };
  }

  window.GongbangHtmlEditor = { mount, renderSafe, sanitize, looksLikeHtml };
})();
