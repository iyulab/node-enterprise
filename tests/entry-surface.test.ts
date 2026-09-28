import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * 진입점 표면 — React 는 `./react` 서브패스에만 있다.
 *
 * 루트 엔트리가 React 컴포넌트를 내보내면 `react` 가 필수 peer 가 되고, npm 은 그것을
 * 이 패키지를 쓰는 **모든** 앱에 설치한다(프리셋만 쓰는 Lit 앱 포함).
 */
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

describe('enterprise 진입점', () => {
  it('🔴루트 엔트리는 React 컴포넌트를 내보내지 않는다', async () => {
    const root = await import('../src/index');
    expect(Object.keys(root)).not.toContain('FormRow');
    expect(Object.keys(root)).not.toContain('FormSection');
  });

  it('🔴./react 서브패스가 둘을 내보내고, exports 맵에 선언돼 있다', async () => {
    const react = await import('../src/react');
    expect(Object.keys(react).sort()).toEqual(['FormRow', 'FormSection']);
    expect(pkg.exports['./react']).toBeDefined();
  });

  it('🔴react 는 선택 peer 다', () => {
    expect(pkg.peerDependencies.react).toBeDefined();
    expect(pkg.peerDependenciesMeta?.react?.optional).toBe(true);
  });
});
