/**
 * MarkCraft - Markdown to HTML Converter Engine & Studio
 * High-performance, zero-dependency Markdown parser with live preview,
 * syntax beautification, and developer tools.
 */

// DOM Elements
const markdownInput = document.getElementById("markdown-input");
const htmlOutput = document.getElementById("html-output");
const preview = document.getElementById("preview");
const container = document.getElementById("container");

// Status & Counter Elements
const wordCountEl = document.getElementById("word-count");
const charCountEl = document.getElementById("char-count");
const lineCountEl = document.getElementById("line-count");
const readTimeEl = document.getElementById("read-time");
const htmlCharCountEl = document.getElementById("html-char-count");
const htmlTagCountEl = document.getElementById("html-tag-count");
const cursorPositionEl = document.getElementById("cursor-position");

// Control Elements
const themeToggleBtn = document.getElementById("theme-toggle");
const layoutSelect = document.getElementById("layout-select");
const templateSelect = document.getElementById("template-select");
const clearBtn = document.getElementById("clear-btn");
const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const copyHtmlBtn = document.getElementById("copy-html-btn");
const copyFullDocBtn = document.getElementById("copy-full-doc-btn");
const copyMdBtn = document.getElementById("copy-md-btn");
const copyPreviewBtn = document.getElementById("copy-preview-btn");
const downloadHtmlBtn = document.getElementById("download-html-btn");
const downloadMdBtn = document.getElementById("download-md-btn");
const printBtn = document.getElementById("print-btn");
const formatModeSelect = document.getElementById("format-mode-select");
const syncScrollCheckbox = document.getElementById("sync-scroll-check");
const toastContainer = document.getElementById("toast-container");

// State
let isFormattedMode = true;
let syncScrollEnabled = true;
let previousText = "";
let isScrolling = false;

// ==========================================
// 1. MARKDOWN PARSER ENGINE
// ==========================================

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
}

/**
 * Parses inline Markdown elements:
 * - Code spans
 * - Images & Links
 * - Bold & Italic
 * - Strikethrough & Highlight
 * - Auto-linking URLs
 */
function convertInline(text) {
    if (!text) return "";

    // 1. Extract inline code spans first into placeholders to protect symbols
    const codeTokens = [];
    text = text.replace(/`([^`]+)`/g, (match, code) => {
        const token = `%%CODE_TOKEN_${codeTokens.length}%%`;
        codeTokens.push(escapeHtml(code));
        return token;
    });

    // 2. Images: ![alt](url "title")
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (match, alt, url, title) => {
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy" />`;
    });

    // 3. Links: [text](url "title")
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (match, linkText, url, title) => {
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
        return `<a href="${escapeHtml(url)}"${titleAttr} target="_blank" rel="noopener noreferrer">${convertInline(linkText)}</a>`;
    });

    // 4. Autolinks: http / https URLs
    text = text.replace(/(?<!["'=])(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

    // 5. Bold & Italic
    // Bold + Italic: ***text*** or ___text___
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
    text = text.replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>");

    // Bold: **text** or __text__
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");

    // Italic: *text* or _text_
    text = text.replace(/\*([^*\s][^*]*[^*\s]|\S)\*/g, "<em>$1</em>");
    text = text.replace(/\b_([^_\s][^_]*[^_\s]|\S)_\b/g, "<em>$1</em>");

    // 6. Strikethrough: ~~text~~
    text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");

    // 7. Highlight / Mark: ==text==
    text = text.replace(/==([^=]+)==/g, "<mark>$1</mark>");

    // 8. Keyboard keys: <kbd>key</kbd>
    text = text.replace(/<kbd>([^<]+)<\/kbd>/g, "<kbd>$1</kbd>");

    // 9. Reinsert inline code spans
    text = text.replace(/%%CODE_TOKEN_(\d+)%%/g, (match, idx) => {
        return `<code>${codeTokens[Number(idx)]}</code>`;
    });

    return text;
}

/**
 * Main block-level parser
 */
function parseMarkdown(md) {
    if (!md) return "";
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // 1. Fenced Code Block
        const codeBlockMatch = line.match(/^```([a-zA-Z0-9_-]*)\s*$/);
        if (codeBlockMatch) {
            const lang = codeBlockMatch[1] || "";
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].match(/^```\s*$/)) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // skip closing ```
            const rawCode = codeLines.join("\n");
            const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
            const langData = lang ? ` data-lang="${escapeHtml(lang)}"` : "";
            
            blocks.push(
                `<pre${langData}><code${langAttr}>${escapeHtml(rawCode)}</code></pre>`
            );
            continue;
        }

        // 2. Horizontal Rule: ---, ***, ___
        if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
            blocks.push("<hr />");
            i++;
            continue;
        }

        // 3. Headings: # H1 to ###### H6
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const headingContent = headingMatch[2].trim();
            const slug = slugify(headingContent);
            blocks.push(`<h${level} id="${slug}">${convertInline(headingContent)}</h${level}>`);
            i++;
            continue;
        }

        // 4. Blockquotes & GitHub-style Alerts
        if (line.match(/^>\s?/)) {
            const quoteLines = [];
            let isAlert = false;
            let alertType = "";

            const firstLineAlertMatch = line.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i);
            if (firstLineAlertMatch) {
                isAlert = true;
                alertType = firstLineAlertMatch[1].toUpperCase();
                i++;
            }

            while (i < lines.length && lines[i].match(/^>\s?/)) {
                quoteLines.push(lines[i].replace(/^>\s?/, ""));
                i++;
            }

            if (isAlert) {
                const alertBody = quoteLines.map((l) => convertInline(l)).join("<br />");
                const alertIconMap = {
                    NOTE: `<svg class="alert-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
                    TIP: `<svg class="alert-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>`,
                    IMPORTANT: `<svg class="alert-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
                    WARNING: `<svg class="alert-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
                    CAUTION: `<svg class="alert-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
                };
                blocks.push(
                    `<div class="markdown-alert markdown-alert-${alertType.toLowerCase()}">` +
                    `<div class="markdown-alert-title">${alertIconMap[alertType] || ""}<span>${alertType.charAt(0) + alertType.slice(1).toLowerCase()}</span></div>` +
                    `<div class="markdown-alert-content"><p>${alertBody}</p></div>` +
                    `</div>`
                );
            } else {
                const quoteText = quoteLines.map((l) => convertInline(l)).join("<br />");
                blocks.push(`<blockquote>\n  <p>${quoteText}</p>\n</blockquote>`);
            }
            continue;
        }

        // 5. GFM Tables
        if (
            line.trim().startsWith("|") &&
            line.trim().endsWith("|") &&
            i + 1 < lines.length &&
            lines[i + 1].includes("|") &&
            /\|[\s-:]+\|/.test(lines[i + 1])
        ) {
            const headerCells = line.split("|").slice(1, -1).map((c) => c.trim());
            const alignCells = lines[i + 1].split("|").slice(1, -1).map((c) => c.trim());

            const alignments = alignCells.map((cell) => {
                if (cell.startsWith(":") && cell.endsWith(":")) return "center";
                if (cell.endsWith(":")) return "right";
                return "left";
            });

            i += 2; // skip header and delimiter

            const rows = [];
            while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
                const rowCells = lines[i].split("|").slice(1, -1).map((c) => c.trim());
                rows.push(rowCells);
                i++;
            }

            let tableHtml = `<div class="table-container">\n  <table>\n    <thead>\n      <tr>\n`;
            headerCells.forEach((th, idx) => {
                const align = alignments[idx] || "left";
                tableHtml += `        <th style="text-align: ${align}">${convertInline(th)}</th>\n`;
            });
            tableHtml += `      </tr>\n    </thead>\n    <tbody>\n`;

            rows.forEach((row) => {
                tableHtml += `      <tr>\n`;
                headerCells.forEach((_, idx) => {
                    const cell = row[idx] || "";
                    const align = alignments[idx] || "left";
                    tableHtml += `        <td style="text-align: ${align}">${convertInline(cell)}</td>\n`;
                });
                tableHtml += `      </tr>\n`;
            });

            tableHtml += `    </tbody>\n  </table>\n</div>`;
            blocks.push(tableHtml);
            continue;
        }

        // 6. Lists (Unordered, Ordered, Task Lists)
        const isBulletList = /^(\s*)([*+-])\s+(.+)$/.test(line);
        const isNumList = /^(\s*)(\d+)\.\s+(.+)$/.test(line);

        if (isBulletList || isNumList) {
            const listItems = [];
            const isOrdered = isNumList;

            while (i < lines.length) {
                const curr = lines[i];
                const bulletMatch = curr.match(/^(\s*)([*+-])\s+(.+)$/);
                const numMatch = curr.match(/^(\s*)(\d+)\.\s+(.+)$/);

                if (bulletMatch || numMatch) {
                    const content = bulletMatch ? bulletMatch[3] : numMatch[3];
                    const taskMatch = content.match(/^\[([ xX])\]\s+(.+)$/);
                    if (taskMatch) {
                        const checked = taskMatch[1].toLowerCase() === "x";
                        listItems.push({
                            isTask: true,
                            checked,
                            text: taskMatch[2]
                        });
                    } else {
                        listItems.push({
                            isTask: false,
                            text: content
                        });
                    }
                    i++;
                } else if (curr.match(/^\s{2,}\S/) && listItems.length > 0) {
                    listItems[listItems.length - 1].text += " " + curr.trim();
                    i++;
                } else {
                    break;
                }
            }

            const tag = isOrdered ? "ol" : "ul";
            const hasTask = listItems.some((item) => item.isTask);
            const listClass = hasTask ? ' class="task-list"' : "";
            let listHtml = `<${tag}${listClass}>\n`;

            listItems.forEach((item) => {
                if (item.isTask) {
                    const checkedAttr = item.checked ? " checked" : "";
                    listHtml += `  <li class="task-list-item"><input type="checkbox" disabled${checkedAttr} class="task-checkbox" /> ${convertInline(item.text)}</li>\n`;
                } else {
                    listHtml += `  <li>${convertInline(item.text)}</li>\n`;
                }
            });

            listHtml += `</${tag}>`;
            blocks.push(listHtml);
            continue;
        }

        // 7. Blank lines
        if (line.trim() === "") {
            i++;
            continue;
        }

        // 8. Paragraphs
        const paraLines = [];
        while (i < lines.length && lines[i].trim() !== "") {
            const currLine = lines[i];
            if (
                currLine.match(/^```/) ||
                /^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(currLine) ||
                currLine.match(/^#{1,6}\s+/) ||
                currLine.match(/^>\s?/) ||
                (currLine.trim().startsWith("|") && currLine.trim().endsWith("|")) ||
                /^(\s*)([*+-]|\d+\.)\s+/.test(currLine)
            ) {
                break;
            }
            paraLines.push(currLine);
            i++;
        }

        if (paraLines.length > 0) {
            const formatted = paraLines
                .map((pl, idx) => {
                    const hasBreak = pl.endsWith("  ") || pl.endsWith("\\");
                    const clean = pl.replace(/(?:  |\\)$/, "");
                    return convertInline(clean) + (hasBreak && idx < paraLines.length - 1 ? "<br />" : "");
                })
                .join(" ");
            blocks.push(`<p>${formatted}</p>`);
        }
    }

    return blocks.join("\n\n");
}

/**
 * Minify HTML string for compact output
 */
function minifyHTML(html) {
    if (!html) return "";
    return html
        .replace(/>[\r\n\t ]+</g, "><")
        .replace(/[\r\n\t ]+/g, " ")
        .trim();
}

/**
 * Generates a full, standalone HTML document with embedded modern styles
 */
function generateFullHTML(bodyContent) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted Markdown Document</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #6366f1;
      --border: #334155;
      --code-bg: #090d16;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --card-bg: #ffffff;
        --text: #0f172a;
        --text-muted: #64748b;
        --accent: #4f46e5;
        --border: #e2e8f0;
        --code-bg: #f1f5f9;
      }
    }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      line-height: 1.7;
      color: var(--text);
      background-color: var(--bg);
      margin: 0;
      padding: 40px 20px;
    }
    .markdown-body {
      max-width: 860px;
      margin: 0 auto;
      background: var(--card-bg);
      padding: 40px;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      border: 1px solid var(--border);
    }
    h1, h2, h3, h4, h5, h6 {
      color: var(--text);
      margin-top: 1.5em;
      margin-bottom: 0.6em;
      font-weight: 700;
      line-height: 1.3;
    }
    h1 { font-size: 2.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; margin-top: 0; }
    h2 { font-size: 1.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
    h3 { font-size: 1.35rem; }
    p { margin: 1em 0; }
    a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.88em;
      background: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 6px;
      border: 1px solid var(--border);
    }
    pre {
      background: var(--code-bg);
      padding: 18px 20px;
      border-radius: 10px;
      overflow-x: auto;
      border: 1px solid var(--border);
    }
    pre code { background: transparent; padding: 0; border: none; }
    blockquote {
      border-left: 4px solid var(--accent);
      margin: 1.5em 0;
      padding: 8px 18px;
      background: rgba(99, 102, 241, 0.06);
      border-radius: 0 8px 8px 0;
      color: var(--text-muted);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5em 0;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 10px 14px;
    }
    th { background: rgba(99, 102, 241, 0.08); font-weight: 600; }
    tr:nth-child(even) { background: rgba(255, 255, 255, 0.02); }
    hr { border: none; height: 1px; background: var(--border); margin: 2em 0; }
    img { max-width: 100%; border-radius: 8px; }
    .task-list { list-style: none; padding-left: 0; }
    .task-list-item { display: flex; align-items: center; gap: 8px; }
  </style>
</head>
<body>
  <article class="markdown-body">
${bodyContent}
  </article>
</body>
</html>`;
}

// ==========================================
// 2. CONVERSION & UI SYNC
// ==========================================

function updateStatistics(markdown, html) {
    // Words
    const words = markdown.trim().match(/\S+/g);
    const wordCount = words ? words.length : 0;
    if (wordCountEl) wordCountEl.textContent = wordCount;

    // Characters
    if (charCountEl) charCountEl.textContent = markdown.length;

    // Lines
    const lines = markdown.length > 0 ? markdown.split("\n").length : 0;
    if (lineCountEl) lineCountEl.textContent = lines;

    // Reading time (average 200 words per min)
    const readMinutes = Math.max(1, Math.ceil(wordCount / 200));
    if (readTimeEl) readTimeEl.textContent = `${readMinutes} min read`;

    // HTML stats
    if (htmlCharCountEl) htmlCharCountEl.textContent = html.length;
    const tagMatches = html.match(/<[a-zA-Z0-9]+(\s|>)/g);
    if (htmlTagCountEl) htmlTagCountEl.textContent = tagMatches ? tagMatches.length : 0;
}

function enhancePreviewCodeBlocks() {
    // Add copy button and language header to code blocks in preview
    const preBlocks = preview.querySelectorAll("pre");
    preBlocks.forEach((pre) => {
        if (pre.querySelector(".code-block-header")) return;

        const code = pre.querySelector("code");
        const lang = pre.getAttribute("data-lang") || (code && code.className.replace("language-", "")) || "code";

        const header = document.createElement("div");
        header.className = "code-block-header";

        const langSpan = document.createElement("span");
        langSpan.className = "code-block-lang";
        langSpan.textContent = lang;

        const copyBtn = document.createElement("button");
        copyBtn.className = "code-copy-btn";
        copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Copy</span>
        `;
        copyBtn.addEventListener("click", () => {
            const rawText = code ? code.textContent : pre.textContent;
            navigator.clipboard.writeText(rawText).then(() => {
                copyBtn.classList.add("copied");
                copyBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Copied!</span>
                `;
                setTimeout(() => {
                    copyBtn.classList.remove("copied");
                    copyBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        <span>Copy</span>
                    `;
                }, 2000);
            });
        });

        header.appendChild(langSpan);
        header.appendChild(copyBtn);
        pre.insertBefore(header, pre.firstChild);
    });
}

function convertMarkdown() {
    const rawMarkdown = markdownInput.value;
    const html = parseMarkdown(rawMarkdown);

    // Format for raw HTML panel
    const displayedHtml = isFormattedMode ? html : minifyHTML(html);
    if (htmlOutput) {
        htmlOutput.textContent = displayedHtml;
    }

    // Render Preview
    if (preview) {
        preview.innerHTML = html;
        enhancePreviewCodeBlocks();
    }

    updateStatistics(rawMarkdown, html);
    return html;
}

// ==========================================
// 3. TOAST SYSTEM
// ==========================================

function showToast(message, type = "success") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    const iconSvg = type === "success" 
        ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`
        : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("show");
    }, 10);

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// ==========================================
// 4. TOOLBAR FORMATTING HELPERS
// ==========================================

function insertFormatting(prefix, suffix = "", defaultText = "text") {
    const start = markdownInput.selectionStart;
    const end = markdownInput.selectionEnd;
    const text = markdownInput.value;
    const selected = text.substring(start, end);

    const replacement = selected.length > 0 ? selected : defaultText;
    const newText = text.substring(0, start) + prefix + replacement + suffix + text.substring(end);
    markdownInput.value = newText;

    const newCursorStart = start + prefix.length;
    const newCursorEnd = newCursorStart + replacement.length;
    markdownInput.focus();
    markdownInput.setSelectionRange(newCursorStart, newCursorEnd);

    convertMarkdown();
}

function insertLinePrefix(prefix) {
    const start = markdownInput.selectionStart;
    const text = markdownInput.value;
    
    // Find beginning of current line
    const lastNewline = text.lastIndexOf("\n", start - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

    const newText = text.substring(0, lineStart) + prefix + text.substring(lineStart);
    markdownInput.value = newText;
    markdownInput.focus();
    markdownInput.setSelectionRange(start + prefix.length, start + prefix.length);

    convertMarkdown();
}

function setupToolbarButtons() {
    const actionMap = {
        "btn-bold": () => insertFormatting("**", "**", "bold text"),
        "btn-italic": () => insertFormatting("*", "*", "italic text"),
        "btn-strikethrough": () => insertFormatting("~~", "~~", "strikethrough"),
        "btn-highlight": () => insertFormatting("==", "==", "highlighted"),
        "btn-h1": () => insertLinePrefix("# "),
        "btn-h2": () => insertLinePrefix("## "),
        "btn-h3": () => insertLinePrefix("### "),
        "btn-quote": () => insertLinePrefix("> "),
        "btn-code": () => insertFormatting("`", "`", "code"),
        "btn-codeblock": () => insertFormatting("```javascript\n", "\n```", "// your code here"),
        "btn-ul": () => insertLinePrefix("- "),
        "btn-ol": () => insertLinePrefix("1. "),
        "btn-task": () => insertLinePrefix("- [ ] "),
        "btn-link": () => insertFormatting("[", "](https://example.com)", "link title"),
        "btn-image": () => insertFormatting("![", "](https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800)", "Image description"),
        "btn-table": () => {
            const tableTemplate = `\n| Column 1 | Column 2 | Column 3 |\n| :--- | :---: | ---: |\n| Value A | Value B | Value C |\n| Data 1 | Data 2 | Data 3 |\n\n`;
            insertFormatting("", "", tableTemplate);
        },
        "btn-hr": () => insertFormatting("\n---\n", "", ""),
        "btn-alert-note": () => insertFormatting("> [!NOTE]\n> ", "", "Helpful information or notice."),
        "btn-alert-tip": () => insertFormatting("> [!TIP]\n> ", "", "Pro tip or best practice."),
        "btn-alert-warning": () => insertFormatting("> [!WARNING]\n> ", "", "Important warning or alert.")
    };

    Object.keys(actionMap).forEach((id) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                actionMap[id]();
            });
        }
    });
}

// ==========================================
// 5. SAMPLE TEMPLATES
// ==========================================

const TEMPLATES = {
    showcase: `# 🚀 MarkCraft - Modern Markdown Studio

Welcome to **MarkCraft**, an advanced Markdown to HTML converter engineered with real-time parsing, typography styling, and instant HTML export!

---

## 🎨 Typography & Inline Styles

You can easily express your ideas with diverse formatting options:
- **Bold text** with \`**bold**\` or \`__bold__\`
- *Italic text* with \`*italic*\` or \`_italic_\`
- ***Bold and italic combined*** with triple asterisks
- ~~Strikethrough~~ with \`~~strikethrough~~\`
- ==Highlighted text== with \`==highlighted==\`
- Interactive links like [Google Search](https://google.com) and auto-links: https://github.com
- Inline code like \`const isReady = true;\`

---

## 💡 GitHub-Style Callout Alerts

> [!NOTE]
> All changes are parsed instantaneously on the client side with zero latency.

> [!TIP]
> Use keyboard shortcuts **Ctrl/Cmd+B** for bold, **Ctrl/Cmd+I** for italic, and **Tab** for 2-space indentation!

> [!WARNING]
> Remember to download or copy your HTML before closing the browser.

---

## 💻 Syntax-Aware Code Blocks

\`\`\`javascript
// High performance Markdown converter
function transformMarkdown(input) {
    const start = performance.now();
    const html = parseMarkdown(input);
    const duration = performance.now() - start;
    console.log(\`Parsed in \${duration.toFixed(2)}ms\`);
    return html;
}
\`\`\`

---

## 📊 GitHub Flavored Markdown (GFM) Tables

| Feature | Support | Performance |
| :--- | :---: | ---: |
| Real-time Parsing | Full | ⚡ 60 FPS |
| GitHub Callouts | 5 Types | 🎨 Vibrant |
| HTML Export | Snippet + Full | 💾 1-Click |
| Dark / Light Theme | Persistent | 🌙 Seamless |

---

## ✅ Task Lists & Checklists

- [x] Implement comprehensive Markdown parser
- [x] Design modern glassmorphic interface
- [x] Add GitHub-style callouts & alert boxes
- [x] Provide one-click HTML copy & download
- [ ] Add custom CSS theme exporter
`,

    blog: `# Building Next-Generation Web Applications in 2026

*Published on October 25, 2026 • 5 min read • by Modern Web Architect*

Modern web development has moved toward **ultra-lightweight, zero-dependency tools** that load instantly and provide frictionless developer experiences.

---

## The Philosophy of Simplicity

> "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away."  
> — *Antoine de Saint-Exupéry*

When building developer tooling, speed is the most critical feature. Every millisecond of latency disrupts flow state.

### Key Architectural Tenets

1. **Client-First Computation:** Process markdown directly inside the browser using optimized regular expressions.
2. **Accessible Semantics:** Produce clean HTML5 elements with appropriate roles and IDs.
3. **Responsive Aesthetics:** Provide dark and light modes with curated color palettes.

\`\`\`typescript
interface DocumentMetrics {
    words: number;
    characters: number;
    readingTimeMinutes: number;
}
\`\`\`

> [!TIP]
> Always verify that your converted HTML passes standard accessibility checks (WCAG 2.1).

---

## Conclusion

By combining modern typography with real-time reactivity, developers can write documentation with unmatched speed and elegance.
`,

    docs: `# API Documentation: HTMLMarkDown v2.0

Comprehensive reference for the Markdown to HTML conversion API and UI components.

---

## Installation & Setup

Simply include the stylesheet and script file in your HTML:

\`\`\`html
<link rel="stylesheet" href="styles.css">
<script src="script.js"></script>
\`\`\`

## Core Methods

### \`parseMarkdown(markdownText: string): string\`

Converts a raw Markdown string into clean, semantic HTML5.

#### Parameters:
- \`markdownText\` *(string)*: The raw Markdown input string.

#### Returns:
- *(string)*: Fully converted HTML.

> [!NOTE]
> The function automatically sanitizes inline code blocks to prevent HTML tag collisions.

---

## Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| \`formatMode\` | \`string\` | \`"formatted"\` | Sets indentation level for HTML output |
| \`syncScroll\` | \`boolean\` | \`true\` | Synchronizes editor and preview scrolling |
| \`theme\` | \`string\` | \`"dark"\` | Active interface color palette |
`
};

// ==========================================
// 6. EVENT LISTENERS & INITIALIZATION
// ==========================================

// Input listener for real-time conversion
markdownInput.addEventListener("input", () => {
    convertMarkdown();
});

// Update cursor position tracking
markdownInput.addEventListener("keyup", updateCursorPos);
markdownInput.addEventListener("click", updateCursorPos);

function updateCursorPos() {
    if (!cursorPositionEl) return;
    const start = markdownInput.selectionStart;
    const textBefore = markdownInput.value.substring(0, start);
    const lineNum = textBefore.split("\n").length;
    const lastNewline = textBefore.lastIndexOf("\n");
    const colNum = lastNewline === -1 ? start + 1 : start - lastNewline;
    cursorPositionEl.textContent = `Ln ${lineNum}, Col ${colNum}`;
}

// Tab key handling inside textarea for 2-space indentation
markdownInput.addEventListener("keydown", (e) => {
    // Shortcuts: Cmd/Ctrl + B, I, K
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

    if (ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        insertFormatting("**", "**", "bold text");
        return;
    }
    if (ctrlKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        insertFormatting("*", "*", "italic text");
        return;
    }
    if (ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        insertFormatting("[", "](https://example.com)", "link title");
        return;
    }

    // Tab key
    if (e.key === "Tab") {
        e.preventDefault();
        const start = markdownInput.selectionStart;
        const end = markdownInput.selectionEnd;
        const value = markdownInput.value;

        if (e.shiftKey) {
            // Shift + Tab (unindent)
            const lineStart = value.lastIndexOf("\n", start - 1) + 1;
            if (value.substr(lineStart, 2) === "  ") {
                markdownInput.value = value.substring(0, lineStart) + value.substring(lineStart + 2);
                markdownInput.selectionStart = markdownInput.selectionEnd = Math.max(lineStart, start - 2);
                convertMarkdown();
            }
        } else {
            // Tab (indent 2 spaces)
            markdownInput.value = value.substring(0, start) + "  " + value.substring(end);
            markdownInput.selectionStart = markdownInput.selectionEnd = start + 2;
            convertMarkdown();
        }
    }
});

// Synchronized scrolling
markdownInput.addEventListener("scroll", () => {
    if (!syncScrollEnabled || isScrolling) return;
    isScrolling = true;
    const scrollPercentage = markdownInput.scrollTop / (markdownInput.scrollHeight - markdownInput.clientHeight);
    if (preview) {
        preview.scrollTop = scrollPercentage * (preview.scrollHeight - preview.clientHeight);
    }
    if (htmlOutput) {
        htmlOutput.scrollTop = scrollPercentage * (htmlOutput.scrollHeight - htmlOutput.clientHeight);
    }
    setTimeout(() => {
        isScrolling = false;
    }, 50);
});

if (preview) {
    preview.addEventListener("scroll", () => {
        if (!syncScrollEnabled || isScrolling) return;
        isScrolling = true;
        const scrollPercentage = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
        markdownInput.scrollTop = scrollPercentage * (markdownInput.scrollHeight - markdownInput.clientHeight);
        setTimeout(() => {
            isScrolling = false;
        }, 50);
    });
}

// Sync scroll toggle
if (syncScrollCheckbox) {
    syncScrollCheckbox.addEventListener("change", (e) => {
        syncScrollEnabled = e.target.checked;
        showToast(syncScrollEnabled ? "Sync scrolling enabled" : "Sync scrolling disabled");
    });
}

// Copy HTML Snippet
if (copyHtmlBtn) {
    copyHtmlBtn.addEventListener("click", () => {
        const textToCopy = htmlOutput.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast("Raw HTML snippet copied to clipboard!");
        });
    });
}

// Copy Full HTML Document
if (copyFullDocBtn) {
    copyFullDocBtn.addEventListener("click", () => {
        const fullDoc = generateFullHTML(parseMarkdown(markdownInput.value));
        navigator.clipboard.writeText(fullDoc).then(() => {
            showToast("Full HTML document with CSS copied!");
        });
    });
}

// Copy Markdown Text
if (copyMdBtn) {
    copyMdBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(markdownInput.value).then(() => {
            showToast("Markdown source copied to clipboard!");
        });
    });
}

// Copy Preview Text
if (copyPreviewBtn) {
    copyPreviewBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(preview.innerText).then(() => {
            showToast("Rendered plain text copied to clipboard!");
        });
    });
}

// Download HTML File
if (downloadHtmlBtn) {
    downloadHtmlBtn.addEventListener("click", () => {
        const fullDoc = generateFullHTML(parseMarkdown(markdownInput.value));
        const blob = new Blob([fullDoc], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "document.html";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Downloaded document.html");
    });
}

// Download Markdown File
if (downloadMdBtn) {
    downloadMdBtn.addEventListener("click", () => {
        const blob = new Blob([markdownInput.value], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "document.md";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Downloaded document.md");
    });
}

// Print / Export PDF
if (printBtn) {
    printBtn.addEventListener("click", () => {
        window.print();
    });
}

// Clear Editor with Undo Toast
if (clearBtn) {
    clearBtn.addEventListener("click", () => {
        if (!markdownInput.value.trim()) return;
        previousText = markdownInput.value;
        markdownInput.value = "";
        convertMarkdown();
        showToast("Editor cleared. Press Ctrl+Z or click Undo to restore.", "info");
    });
}

// Format Mode Switcher (Formatted vs Minified)
if (formatModeSelect) {
    formatModeSelect.addEventListener("change", (e) => {
        isFormattedMode = e.target.value === "formatted";
        convertMarkdown();
        showToast(`HTML Output: ${isFormattedMode ? "Formatted" : "Minified"}`);
    });
}

// Template Selector
if (templateSelect) {
    templateSelect.addEventListener("change", (e) => {
        const selected = e.target.value;
        if (TEMPLATES[selected]) {
            markdownInput.value = TEMPLATES[selected];
            convertMarkdown();
            showToast(`Loaded "${selected.toUpperCase()}" template!`);
        }
    });
}

// File Upload
if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            markdownInput.value = event.target.result;
            convertMarkdown();
            showToast(`Loaded file: ${file.name}`);
        };
        reader.readAsText(file);
    });
}

// Drag & Drop File into Editor
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith(".md") || file.name.endsWith(".txt") || file.type.includes("text")) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                markdownInput.value = ev.target.result;
                convertMarkdown();
                showToast(`Imported ${file.name}`);
            };
            reader.readAsText(file);
        }
    }
});

// Layout Switcher
if (layoutSelect && container) {
    layoutSelect.addEventListener("change", (e) => {
        const mode = e.target.value;
        container.className = `layout-${mode}`;
        showToast(`Layout changed to ${mode.replace("-", " ")}`);
    });
}

// Mobile Tab Switcher
const tabButtons = document.querySelectorAll(".tab-btn");
if (tabButtons) {
    tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            tabButtons.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const targetPanel = btn.getAttribute("data-target");

            document.querySelectorAll(".panel-container").forEach((panel) => {
                if (panel.id === targetPanel) {
                    panel.classList.add("active-tab-panel");
                } else {
                    panel.classList.remove("active-tab-panel");
                }
            });
        });
    });
}

// Theme Switcher (Dark / Light)
function initTheme() {
    const savedTheme = localStorage.getItem("markcraft-theme") || 
        (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    
    setTheme(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
            const nextTheme = currentTheme === "dark" ? "light" : "dark";
            setTheme(nextTheme);
            showToast(`Switched to ${nextTheme} theme`);
        });
    }
}

function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("markcraft-theme", theme);

    if (themeToggleBtn) {
        const isDark = theme === "dark";
        themeToggleBtn.innerHTML = isDark
            ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg><span class="theme-label">Light Mode</span>`
            : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span class="theme-label">Dark Mode</span>`;
    }
}

// Initial Boot
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    setupToolbarButtons();

    // Default template load if input is empty
    if (!markdownInput.value.trim()) {
        markdownInput.value = TEMPLATES.showcase;
    }

    convertMarkdown();
    updateCursorPos();
});