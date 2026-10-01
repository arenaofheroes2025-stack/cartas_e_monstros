export const DIALOG_CHOICE_KEYS=['z','x','c','v'] as const;

export function dialogChoiceIndex(key:string):number {
  return DIALOG_CHOICE_KEYS.indexOf(key as typeof DIALOG_CHOICE_KEYS[number]);
}
