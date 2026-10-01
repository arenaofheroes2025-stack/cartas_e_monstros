import { describe, expect, it } from 'vitest';
import { DIALOG_CHOICE_KEYS, dialogChoiceIndex } from './dialogChoices';

describe('atalhos das escolhas de diálogo',()=>{
  it('oferece letras estáveis para as quatro opções possíveis',()=>{
    expect(DIALOG_CHOICE_KEYS).toEqual(['z','x','c','v']);
    expect(DIALOG_CHOICE_KEYS.map(dialogChoiceIndex)).toEqual([0,1,2,3]);
    expect(dialogChoiceIndex('e')).toBe(-1);
  });
});
