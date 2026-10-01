import {describe,it,expect} from 'vitest';
import {normalizeAppUrl} from '../packages/shared/app-url';
describe('web-app address validation',()=>{
 it('accepts a deployed HTTPS root and canonicalizes whitespace and trailing slash',()=>{expect(normalizeAppUrl('  https://example.org/  ')).toBe('https://example.org');});
 it('accepts explicit loopback development origins',()=>{expect(normalizeAppUrl('http://localhost:5183')).toBe('http://localhost:5183');expect(normalizeAppUrl('http://127.0.0.1:5183/')).toBe('http://127.0.0.1:5183');});
 it.each(['javascript:alert(1)','data:text/html,test','https://user:secret@example.org','http://example.org','https://example.org/?token=secret','https://example.org/#token','https://example.org/path','file:///C:/x',''])('rejects unsafe or unsupported address %s',raw=>{expect(()=>normalizeAppUrl(raw)).toThrow();});
});
