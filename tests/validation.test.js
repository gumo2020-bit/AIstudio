import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validAnswer,reasonLength,escapeHtml,percent} from '../src/utils.js';
test('선택과 공백 제외 이유 길이를 검사한다',()=>{
 assert.equal(validAnswer({choice:'A',reason:'이유 짧음'}),false);
 assert.equal(validAnswer({choice:'B',reason:'개인정보를 보호해야 합니다.'}),true);
 assert.equal(validAnswer({choice:'C',reason:'다섯글자이상'}),false);
 assert.equal(validAnswer({choice:'A',reason:'가'.repeat(1001)}),false);
 assert.equal(reasonLength('가 나\n다 라\t마'),5);
});
test('응답 내용은 HTML로 실행되지 않는다',()=>{
 assert.equal(escapeHtml('<script>"&\'</script>'),'&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;');
});
test('응답이 없을 때 비율은 0이다',()=>{assert.equal(percent(0,0),0);assert.equal(percent(2,3),67);});
