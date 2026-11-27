"use client";

import { useTranslations } from "next-intl";
import { inlineLinks, removeInlineLink, replaceInlineLink } from "@/contracts";
import { TaskTextEditor } from "./task-text-editor";
import { TypedLinkInput } from "./typed-link-input";

interface Props {
  number: number;
  text: string;
  tooLong: boolean;
  onChange: (text: string) => void;
}

/** The description with link chips, followed by one input per link in the order of the text. */
export function TaskTextField({ number, text, tooLong, onChange }: Props) {
  const t = useTranslations("checklist");

  return (
    <>
      <TaskTextEditor
        text={text}
        label={t("itemLabel", { number })}
        placeholder={t("itemPlaceholder")}
        invalid={tooLong}
        onChange={onChange}
      />
      {inlineLinks(text).map((url, index) => (
        <TypedLinkInput
          key={`${index}-${url}`}
          url={url}
          label={t("linkLabel", { number, link: index + 1 })}
          removeLabel={t("removeSpecificLink", { number: index + 1 })}
          onChange={(next) => onChange(replaceInlineLink(text, index, next))}
          onRemove={() => onChange(removeInlineLink(text, index))}
        />
      ))}
    </>
  );
}
