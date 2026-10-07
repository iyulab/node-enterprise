import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
// 정적 import — 시험 본문에서 `await import` 하면 첫 변환(모듈 그래프 전체)이 시험 시간에 들어가, 브라우저 프로젝트와
// 함께 도는 전체 실행에서 5초 제한을 넘겼다. 변환은 수집 단계의 일이다.
import * as rootEntry from '../src/index';
import * as reactEntry from '../src/react';

/**
 * 진입점 표면 — React 는 `./react` 서브패스에만 있다.
 *
 * 루트 엔트리가 React 컴포넌트를 내보내면 `react` 가 필수 peer 가 되고, npm 은 그것을
 * 이 패키지를 쓰는 **모든** 앱에 설치한다(프리셋만 쓰는 Lit 앱 포함).
 */
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));

describe('enterprise 진입점', () => {
  it('🔴루트 엔트리는 React 컴포넌트를 내보내지 않는다', () => {
    const root = rootEntry;
    expect(Object.keys(root)).not.toContain('FormRow');
    expect(Object.keys(root)).not.toContain('FormSection');
  });

  it('🔴./react 서브패스가 셋을 내보내고, exports 맵에 선언돼 있다', () => {
    const react = reactEntry;
    expect(Object.keys(react).sort()).toEqual(['FormRow', 'FormSection', 'ListPage']);
    expect(pkg.exports['./react']).toBeDefined();
  });

  it('🔴목록 골격은 ./list-page 에서 등록되고 루트는 그것을 싣지 않는다 — @lit/react 는 선택 peer', () => {
    const root = rootEntry;
    expect(Object.keys(root)).not.toContain('UListPage');
    expect(pkg.exports['./list-page']).toBeDefined();
    expect(pkg.sideEffects).toContain('./dist/*.js'); // 등록이 든 공유 청크는 해시 이름이다
    expect(pkg.peerDependenciesMeta?.['@lit/react']?.optional).toBe(true);
  });

  it('🔴react 는 선택 peer 다', () => {
    expect(pkg.peerDependencies.react).toBeDefined();
    expect(pkg.peerDependenciesMeta?.react?.optional).toBe(true);
  });
});
