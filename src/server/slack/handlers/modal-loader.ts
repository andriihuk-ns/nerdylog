import { DEFAULT_LOCALE, type IsoDate, type Locale, type SlackSubmissionKind } from "@/contracts";
import { previousBusinessDay } from "@/server/services/calendar";
import { loadingModal, noticeModal, notLinkedMessage } from "../blocks/common";
import { buildPtoModal } from "../blocks/pto-modal";
import { buildTimeModal } from "../blocks/time-modal";
import { localIsoDate, yearOf } from "../dates";
import { localeOf, t, type MessageKey } from "../i18n";
import type { ModalMetadata } from "../metadata";
import type { SlackDeps, TempoPorts } from "../types";
import { promptDenial, selectableProjects } from "./project-access";

export interface OpenModalRequest {
  kind: SlackSubmissionKind;
  slackUserId: string;
  triggerId: string;
  /** Pre-computed default date (from the project prompt button); otherwise derived. */
  logDate?: IsoDate | null;
  /** A16: project to preselect in row 1 (project prompt button). */
  projectId?: string | null;
}

const TITLES: Record<SlackSubmissionKind, MessageKey> = { standup: "title.standup", log: "title.log", pto: "title.pto" };

/** A15: holidays of the user's own office in [from, to] (no office → empty set). */
export async function holidaySet(tempo: TempoPorts, userId: string, from: IsoDate, to: IsoDate): Promise<Set<IsoDate>> {
  return new Set(await tempo.listHolidayDates(userId, from, to));
}

/**
 * Step 1 (inside the 3 s window): open a "Loading…" modal with the trigger id before any
 * DB work. Step 2 (deferred): load the user and projects, then replace it via views.update.
 * Returns false when Slack refused views.open (expired trigger, API error).
 */
export async function openModalFast(deps: SlackDeps, req: OpenModalRequest): Promise<boolean> {
  let viewId: string;
  try {
    viewId = await deps.slack.openView(req.triggerId, loadingModal());
  } catch (error) {
    console.error("slack: views.open failed", error instanceof Error ? error.message : error);
    return false;
  }
  deps.defer(() => fillModal(deps, req, viewId));
  return true;
}

async function fillModal(deps: SlackDeps, req: OpenModalRequest, viewId: string): Promise<void> {
  let locale: Locale = DEFAULT_LOCALE; // A14: unknown users (and lookup failures) → uk
  try {
    const profile = await deps.tempo.resolveUser(req.slackUserId);
    if (!profile) {
      const notice = noticeModal(t(locale, TITLES[req.kind]), notLinkedMessage(deps.appBaseUrl, locale), locale);
      await deps.slack.updateView(viewId, notice);
      return;
    }
    locale = localeOf(profile);
    const today = localIsoDate(deps.now(), profile.timezone);
    let logDate = req.logDate ?? null;
    if (!logDate) {
      logDate =
        req.kind === "pto"
          ? today
          : previousBusinessDay(today, await holidaySet(deps.tempo, profile.userId, `${yearOf(today) - 1}-01-01`, today));
    }
    const meta: ModalMetadata = { kind: req.kind, logDate, userId: profile.userId, today, rows: 1 };
    if (req.kind === "pto") {
      await deps.slack.updateView(viewId, buildPtoModal(meta, locale));
      return;
    }
    const projects = await deps.tempo.listProjects(profile);
    if (req.projectId) {
      // A16: reached only when the click's pre-check timed out; show the denial in the modal.
      const denial = promptDenial(profile, projects.find((p) => p.id === req.projectId), deps.appBaseUrl);
      if (denial) {
        await deps.slack.updateView(viewId, noticeModal(t(locale, TITLES[req.kind]), denial.text, locale));
        return;
      }
      meta.projectId = req.projectId;
    }
    await deps.slack.updateView(viewId, buildTimeModal({ meta, projects: selectableProjects(projects), locale }));
  } catch (error) {
    console.error("slack: modal load failed", error instanceof Error ? error.message : error);
    await deps.slack
      .updateView(viewId, noticeModal(t(locale, TITLES[req.kind]), t(locale, "common.loadFailed"), locale))
      .catch(() => undefined);
  }
}

/**
 * "+ Add project" / "Remove last" / checklist item actions: rebuild the time modal with updated metadata,
 * keeping block ids (and the row-1 preselection) so Slack keeps what the user already typed.
 */
export async function updateTimeModal(
  deps: SlackDeps,
  args: { slackUserId: string; viewId: string; hash?: string; meta: ModalMetadata },
): Promise<void> {
  const profile = await deps.tempo.resolveUser(args.slackUserId);
  if (!profile || profile.userId !== args.meta.userId) return;
  const projects = await deps.tempo.listProjects(profile);
  const view = buildTimeModal({ meta: args.meta, projects: selectableProjects(projects), locale: localeOf(profile) });
  await deps.slack.updateView(args.viewId, view, args.hash);
}

export async function resizeTimeModal(
  deps: SlackDeps,
  args: { slackUserId: string; viewId: string; hash?: string; meta: ModalMetadata; rows: number },
): Promise<void> {
  return updateTimeModal(deps, { ...args, meta: { ...args.meta, rows: args.rows } });
}
