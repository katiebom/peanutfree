// src/data/allergyCardTexts.js
// 알레르기 카드 문구 — 카드 탭과 식당·브랜드 상세의 카드 모달이 같은 문구를 쓴다.
// allergyType: 'peanut' | 'nut' / severity: 'severe' | 'mild'

export const LANGS = [
  { key: 'ko', label: '한국어', flag: '🇰🇷' },
  { key: 'en', label: 'English', flag: '🇺🇸' },
  { key: 'ja', label: '日本語', flag: '🇯🇵' },
  { key: 'zh', label: '中文', flag: '🇨🇳' },
];

// 음식에 안 들어가도 튀김기름·쉐이크 기계 같은 공용 설비가 문제가 된다 (예: 파이브가이즈 공식 표)
const CROSS = {
  ko: '같은 기름이나 조리도구를 함께 쓰는 경우도 꼭 알려 주세요.',
  en: 'Please also tell me if it is cooked in the same oil or with shared equipment.',
  ja: '同じ油や調理器具を共用している場合も必ず教えてください。',
  zh: '如果与含花生的食物共用油锅或厨具，也请务必告诉我。',
};
const CROSS_NUT = {
  ...CROSS,
  zh: '如果与含坚果的食物共用油锅或厨具，也请务必告诉我。',
};

const BASE = {
  ko: {
    peanut: { severe: '저는 땅콩 알레르기가 있습니다. 알레르기 반응이 심각하여 생명에 위험할 수 있습니다. 이 음식에 땅콩이나 땅콩 기름이 들어있나요? 주의 깊게 확인해 주세요.', mild: '저는 땅콩 알레르기가 있습니다. 이 음식에 땅콩이나 땅콩 기름이 들어있나요? 주의 깊게 확인해 주세요.' },
    nut: { severe: '저는 견과류 알레르기가 있습니다. 알레르기 반응이 심각하여 생명에 위험할 수 있습니다. 이 음식에 견과류가 들어있나요? 주의 깊게 확인해 주세요.', mild: '저는 견과류 알레르기가 있습니다. 이 음식에 견과류가 들어있나요? 주의 깊게 확인해 주세요.' },
  },
  en: {
    peanut: { severe: 'I have a peanut allergy. My allergy is severe and life-threatening. Does this dish contain peanuts or peanut oil? Please check carefully.', mild: 'I have a peanut allergy. Does this dish contain peanuts or peanut oil? Please check carefully.' },
    nut: { severe: 'I have a nut allergy. My allergy is severe and life-threatening. Does this dish contain nuts or nut oil? Please check carefully.', mild: 'I have a nut allergy. Does this dish contain nuts or nut oil? Please check carefully.' },
  },
  ja: {
    peanut: { severe: '私はピーナッツアレルギーがあります。アレルギー反応が重篤で、生命に関わる場合があります。この料理にピーナッツやピーナッツオイルは含まれていますか？', mild: '私はピーナッツアレルギーがあります。この料理にピーナッツやピーナッツオイルは含まれていますか？' },
    nut: { severe: '私はナッツアレルギーがあります。アレルギー反応が重篤で、生命に関わる場合があります。この料理にナッツ類は含まれていますか？', mild: '私はナッツアレルギーがあります。この料理にナッツ類は含まれていますか？' },
  },
  zh: {
    peanut: { severe: '我对花生过敏。我的过敏反应很严重，可能危及生命。这道菜含有花生或花生油吗？请仔细确认。', mild: '我对花生过敏。这道菜含有花生或花生油吗？请仔细确认。' },
    nut: { severe: '我对坚果过敏。我的过敏反应很严重，可能危及生命。这道菜含有坚果吗？请仔细确认。', mild: '我对坚果过敏。这道菜含有坚果吗？请仔细确认。' },
  },
};

export function cardText(lang, allergyType, severity) {
  const cross = (allergyType === 'nut' ? CROSS_NUT : CROSS)[lang];
  return `${BASE[lang][allergyType][severity]} ${cross}`;
}

// 심각 단계에서만 보여준다. 직원이 읽을 한국어를 맨 위에.
export const EMERGENCY = [
  { key: 'ko', text: '제게 알레르기 반응(두드러기, 입술·목 부음, 숨쉬기 어려움)이 생기면 바로 119에 전화해 주세요. 에피네프린 자가주사기(에피펜)를 갖고 있다면 사용을 도와주세요.' },
  { key: 'en', text: 'If I have an allergic reaction (hives, swelling of lips or throat, trouble breathing), please call 119 immediately. If I carry an epinephrine auto-injector (EpiPen), please help me use it.' },
];

export const CARD_PREFS_KEY = 'pf_allergyCardPrefs';
