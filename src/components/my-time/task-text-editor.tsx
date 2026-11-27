"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { renderText, readText, selectionOffsets, setCaret } from "./rich-text-dom";

interface Props {
  text: string;
  label: string;
  placeholder: string;
  invalid: boolean;
  onChange: (text: string) => void;
}

interface Step {
  text: string;
  caret: number;
}

/** Typing within this window is undone as one step. */
const TYPING_GROUP_MS = 600;

/**
 * Task description with links shown as favicon chips. The DOM is the editor's own: React never
 * renders children into it. Programmatic edits break native undo, so undo history is kept here.
 */
export function TaskTextEditor({ text, label, placeholder, invalid, onChange }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const history = useRef<{ steps: Step[]; at: number; typedAt: number }>({ steps: [{ text, caret: text.length }], at: 0, typedAt: 0 });

  function record(step: Step, typing = false) {
    const log = history.current;
    const grouped = typing && log.at > 0 && log.at === log.steps.length - 1 && Date.now() - log.typedAt < TYPING_GROUP_MS;
    log.steps = [...log.steps.slice(0, grouped ? log.at : log.at + 1), step];
    log.at = log.steps.length - 1;
    log.typedAt = typing ? Date.now() : 0;
  }

  function show(step: Step) {
    const element = root.current;
    if (!element) return;
    renderText(element, step.text);
    element.dataset.empty = String(!step.text);
    setCaret(element, step.caret);
    onChange(step.text);
  }

  /** Replaces the selection, turning any URL in the result into a chip. */
  function insert(inserted: string) {
    const element = root.current;
    if (!element) return;
    const current = readText(element);
    const { start, end } = selectionOffsets(element) ?? { start: current.length, end: current.length };
    const step = { text: current.slice(0, start) + inserted + current.slice(end), caret: start + inserted.length };
    record(step);
    show(step);
  }

  function travel(by: -1 | 1) {
    const log = history.current;
    const step = log.steps[log.at + by];
    if (!step) return;
    log.at += by;
    log.typedAt = 0;
    show(step);
  }

  // First render, and changes made outside the editor (a link edited or removed below).
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    element.dataset.empty = String(!text);
    if (element.childNodes.length > 0 && readText(element) === text) return;
    renderText(element, text);
    if (history.current.steps[history.current.at].text !== text) record({ text, caret: text.length });
  }, [text]);

  function input() {
    const element = root.current;
    if (!element) return;
    const next = readText(element);
    element.dataset.empty = String(!next);
    record({ text: next, caret: selectionOffsets(element)?.start ?? next.length }, true);
    onChange(next);
  }

  function keyDown(event: KeyboardEvent) {
    if (event.nativeEvent.isComposing) return;
    const command = event.metaKey || event.ctrlKey;
    if (event.key === "Enter" && !command) {
      event.preventDefault();
      insert("\n");
    } else if (command && event.key.toLowerCase() === "z") {
      event.preventDefault();
      travel(event.shiftKey ? 1 : -1);
    } else if (command && ["b", "i", "u"].includes(event.key.toLowerCase())) {
      event.preventDefault();
    }
  }

  function paste(event: ClipboardEvent) {
    event.preventDefault();
    insert(event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n"));
  }

  /** Copying a chip copies its URL. */
  function copy(event: ClipboardEvent, cut: boolean) {
    const element = root.current;
    const range = element && selectionOffsets(element);
    if (!element || !range || range.start === range.end) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", readText(element).slice(range.start, range.end));
    if (cut) insert("");
  }

  return (
    <div
      ref={root}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline
      aria-label={label}
      aria-invalid={invalid || undefined}
      data-placeholder={placeholder}
      onInput={input}
      onKeyDown={keyDown}
      onPaste={paste}
      onCopy={(event) => copy(event, false)}
      onCut={(event) => copy(event, true)}
      onDrop={(event) => event.preventDefault()}
      // Typed URLs become chips once the caret has left.
      onBlur={() => root.current && renderText(root.current, readText(root.current))}
      className="min-h-19 w-full px-1 py-2 text-sm leading-7 break-words whitespace-pre-wrap outline-none data-[empty=true]:before:pointer-events-none data-[empty=true]:before:float-left data-[empty=true]:before:h-0 data-[empty=true]:before:text-muted-foreground data-[empty=true]:before:content-[attr(data-placeholder)]"
    />
  );
}
