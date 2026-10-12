// 원문 인용이 페이지에 있는지 판정한다. check-sources.mjs 가 쓴다.
// 비교용 정규화: 태그·공백·문장부호·구분자(|) 제거
export const squash = t => t.toLowerCase().replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;|&#34;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[\s·・,.:;!?'"“”‘’…()\[\]{}\-–—~*|]+/g, '');

// 태그 속성(data-allergy="우유|밀|땅콩" 등)에 든 값. 태그를 지우면 같이 사라지므로 따로 모은다
export const attrValues = html => [...html.matchAll(/\sdata-[\w-]+\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => m[1] ?? m[2]).join(' ');

/** @returns {{found:boolean, via?:'text'|'attr'}} */
export function quoteFound(html, quote) {
  const q = squash(quote);
  if (!q) return { found: false };
  const text = squash(html);
  if (text.includes(q)) return { found: true, via: 'text' };
  // "이름 | 알레르기 성분" 꼴 인용: 이름은 본문에, 성분은 속성값에 있는 경우.
  // 모든 조각이 본문 또는 속성값에 있고, 최소 한 조각이 속성값에서만 나올 때 통과시킨다
  const attrs = squash(attrValues(html));
  if (attrs.includes(q)) return { found: true, via: 'attr' };
  const parts = quote.split('|').map(squash).filter(Boolean);
  if (parts.length >= 2 && attrs && parts.every(p => text.includes(p) || attrs.includes(p)) && parts.some(p => attrs.includes(p)))
    return { found: true, via: 'attr' };
  return { found: false };
}
