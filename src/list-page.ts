/**
 * @iyulab/enterprise/list-page — the `u-list-page` list skeleton (a custom element).
 *
 * A subpath of its own so that an app which uses only the data services, the auth client or `bindSource`
 * does not load Lit or register an element: importing this module registers `u-list-page`.
 */
export { UListPage } from './list/UListPage';
export type { ListPageStatus } from './list/UListPage';
