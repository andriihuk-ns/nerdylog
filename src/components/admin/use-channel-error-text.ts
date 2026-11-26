"use client";

import { useTranslations } from "next-intl";
import { channelErrorCopy } from "./channel-options";

type Failure = Parameters<typeof channelErrorCopy>[0];

/** Failed channel save → inline sentence in the active locale. */
export function useChannelErrorText(): (failure: Failure, channelName: string | undefined) => string {
  const t = useTranslations("admin.channel");
  return (failure, channelName) => {
    const copy = channelErrorCopy(failure, channelName);
    if (copy.kind === "privateInvite") {
      return copy.channel ? t("privateInvite", { channel: copy.channel }) : t("privateInviteUnknown");
    }
    return copy.kind === "notFound" ? t("notFound") : copy.message;
  };
}
