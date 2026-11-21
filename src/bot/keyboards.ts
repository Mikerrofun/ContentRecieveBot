import { InlineKeyboard } from "grammy";

export const CALLBACK = {
  more: "accept:more",
  finalize: "accept:finalize",
  cancel: "accept:cancel",
  cancelYes: "cancel:yes",
  cancelNo: "cancel:no",
} as const;

/** [Ещё добавлю] [Загрузить в систему] (+ [Отмена]) */
export function acceptKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Ещё добавлю", CALLBACK.more)
    .text("Загрузить в систему", CALLBACK.finalize)
    .row()
    .text("Отмена", CALLBACK.cancel);
}

export function cancelConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Да, отменить", CALLBACK.cancelYes)
    .text("Нет, продолжить", CALLBACK.cancelNo);
}
