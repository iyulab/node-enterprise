/**
 * @iyulab/enterprise/react — the React components.
 *
 * Kept off the root entry so that an app which is not a React app (or uses only
 * the data services or the auth client) neither imports React nor is asked to install it:
 * `react` is an optional peer dependency, needed only by this subpath.
 */
export { FormSection } from './FormSection'
export { FormRow } from './FormRow'

import React from 'react'
import { createComponent } from '@lit/react'
// 상대 경로다 — `./list-page` 엔트리와 이 엔트리가 같은 모듈을 가리키므로 빌드가 그것을 공유 청크 하나로 떼고, 소비자가
// 둘을 함께 써도 `u-list-page` 는 한 번 등록된다(등록이 든 청크는 해시 이름이라 `sideEffects` 가 `./dist/*.js` 다).
// 패키지 이름으로 자기 자신을 가리키면 api-extractor(타입 번들)가 그 선언을 분석하지 못해 빌드가 죽는다.
import { UListPage } from './list/UListPage'

/**
 * React wrapper for `<u-list-page>`. `source` is a property (an object), which a raw custom element in JSX
 * stringifies under React 18 — the wrapper assigns it as a property on both React 18 and 19.
 * The skeleton fires no events of its own; listen to the view (`row-activate`, `selection-change`) directly.
 */
export const ListPage = createComponent({
  react: React,
  tagName: 'u-list-page',
  elementClass: UListPage,
})

export type ListPageProps = React.ComponentProps<typeof ListPage>
