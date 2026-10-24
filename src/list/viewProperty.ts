/** 요소에 `key` 가 있고 쓸 수 있는가 — 데이터 속성(쓰기 가능)이거나 setter 를 가진 접근자. 프로토타입 사슬을 따라간다. */
export function writable(target: object, key: string): boolean {
  for (let o: object | null = target; o; o = Object.getPrototypeOf(o)) {
    const d = Object.getOwnPropertyDescriptor(o, key);
    if (d) return 'value' in d ? d.writable === true : typeof d.set === 'function';
  }
  return false;
}
