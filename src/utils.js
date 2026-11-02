export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const reasonLength = s => [...s.replace(/\s/g,'')].length;
export const validAnswer = a => ['A','B'].includes(a?.choice) && reasonLength(a.reason)>=5 && reasonLength(a.reason)<=1000;
export const percent = (n,total) => total ? Math.round(n/total*100) : 0;
export const genders = {female:'여성',male:'남성',other:'기타',undisclosed:'응답하지 않음'};
