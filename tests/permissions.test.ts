import { describe, it, expect, vi } from 'vitest'
import {
  createPermissionStore,
  defaultPermissionStore,
  setPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  clearPermissions,
} from '../src/auth/permissions'

describe('createPermissionStore', () => {
  it('set/get/has round-trips codes', () => {
    const store = createPermissionStore()
    store.set(['orders.read', 'orders.write'])
    expect(store.has('orders.read')).toBe(true)
    expect(store.has('admin.maintenance')).toBe(false)
    expect([...store.get()]).toEqual(['orders.read', 'orders.write'])
  })

  it('hasAny/hasAll semantics (empty list = true)', () => {
    const store = createPermissionStore(['a', 'b'])
    expect(store.hasAny(['x', 'b'])).toBe(true)
    expect(store.hasAny(['x', 'y'])).toBe(false)
    expect(store.hasAny([])).toBe(true)
    expect(store.hasAll(['a', 'b'])).toBe(true)
    expect(store.hasAll(['a', 'c'])).toBe(false)
    expect(store.hasAll([])).toBe(true)
  })

  it('clear empties and notifies subscribers only on change', () => {
    const store = createPermissionStore(['a'])
    const listener = vi.fn()
    const unsub = store.subscribe(listener)
    store.set(['b'])
    expect(listener).toHaveBeenCalledTimes(1)
    store.clear()
    expect(listener).toHaveBeenCalledTimes(2)
    store.clear() // already empty → no emit
    expect(listener).toHaveBeenCalledTimes(2)
    unsub()
    store.set(['c'])
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('is false-by-default before any set', () => {
    const store = createPermissionStore()
    expect(store.has('anything')).toBe(false)
  })
})

describe('default singleton free functions', () => {
  it('bind to defaultPermissionStore', () => {
    clearPermissions()
    setPermissions(['reports.view'])
    expect(hasPermission('reports.view')).toBe(true)
    expect(hasAnyPermission(['reports.view', 'x'])).toBe(true)
    expect(hasAllPermissions(['reports.view'])).toBe(true)
    expect(defaultPermissionStore.has('reports.view')).toBe(true)
    clearPermissions()
    expect(hasPermission('reports.view')).toBe(false)
  })
})
