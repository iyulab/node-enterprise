import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createODataService, ApiError, wasNotified } from '../src/data/ODataService'

// ---- fetch 목: 요청을 기록하고 큐에 넣은 응답을 순서대로 돌려준다 ----
interface Recorded {
  url: string
  method: string
  body?: string
  rawBody?: BodyInit
  contentType?: string | null
}
let recorded: Recorded[] = []
let queue: Response[] = []

function enqueue(res: Response) {
  queue.push(res)
}
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  recorded = []
  queue = []
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    recorded.push({
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      body: typeof init?.body === 'string' ? init.body : undefined,
      rawBody: init?.body as BodyInit | undefined,
      contentType: init?.headers ? new Headers(init.headers).get('Content-Type') : null,
    })
    const res = queue.shift()
    if (!res) throw new Error(`no queued response for ${String(input)}`)
    return Promise.resolve(res)
  })
})

const BASE = 'https://app.test'

describe('createODataService — URL building', () => {
  it('builds odata/api URLs from configured prefixes', () => {
    const svc = createODataService({ baseUrl: BASE })
    expect(svc.odataUrl('Orders')).toBe(`${BASE}/$data/Orders`)
    expect(svc.apiUrl('auth/me')).toBe(`${BASE}/api/auth/me`)
    expect(svc.apiUrl('/auth/me')).toBe(`${BASE}/api/auth/me`)
  })

  it('honors custom prefixes', () => {
    const svc = createODataService({ baseUrl: BASE, odataPrefix: 'odata', apiPrefix: 'v1' })
    expect(svc.odataUrl('Orders')).toBe(`${BASE}/odata/Orders`)
    expect(svc.apiUrl('ping')).toBe(`${BASE}/v1/ping`)
  })
})

describe('createODataService — reads', () => {
  it('odataGet unwraps the OData value array', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ value: [{ id: 1 }, { id: 2 }] }))
    const rows = await svc.odataGet<{ id: number }>('Orders', { $top: '20' })
    expect(rows).toEqual([{ id: 1 }, { id: 2 }])
    expect(recorded[0].url).toBe(`${BASE}/$data/Orders?%24top=20`)
  })

  it('odataGetById builds the (id) key URL', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ id: 7 }))
    const row = await svc.odataGetById<{ id: number }>('Orders', '7')
    expect(row).toEqual({ id: 7 })
    expect(recorded[0].url).toBe(`${BASE}/$data/Orders(7)`)
  })

  it('odataCount reads @odata.count', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ '@odata.count': 42, value: [] }))
    const n = await svc.odataCount('Orders')
    expect(n).toBe(42)
  })
})

describe('createODataService — mutations + toasts', () => {
  it('odataPost normalizes empty strings to null and fires success toast', async () => {
    const success = vi.fn()
    const svc = createODataService({
      baseUrl: BASE,
      notify: { success },
      messages: { saved: '저장되었습니다' },
    })
    enqueue(json({ id: 1, name: 'a' }, 201))
    await svc.odataPost('Orders', { name: 'a', note: '' })
    expect(success).toHaveBeenCalledWith('저장되었습니다')
    expect(JSON.parse(recorded[0].body!)).toEqual({ name: 'a', note: null })
  })

  it('odataPostQuiet does not toast on success', async () => {
    const success = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { success } })
    enqueue(json({ id: 1 }, 201))
    await svc.odataPostQuiet('Orders', { name: 'a' })
    expect(success).not.toHaveBeenCalled()
  })

  it('odataPatch fires updated toast; odataDelete fires deleted toast', async () => {
    const success = vi.fn()
    const svc = createODataService({
      baseUrl: BASE,
      notify: { success },
      messages: { updated: '수정되었습니다', deleted: '삭제되었습니다' },
    })
    enqueue(new Response(null, { status: 204 }))
    await svc.odataPatch('Orders', '7', { name: 'b' })
    expect(success).toHaveBeenCalledWith('수정되었습니다')
    expect(recorded[0].url).toBe(`${BASE}/$data/Orders(7)`)

    enqueue(new Response(null, { status: 204 }))
    await svc.odataDelete('Orders', '7')
    expect(success).toHaveBeenCalledWith('삭제되었습니다')
  })

  // §D-33 / ISSUE-enterprise-20260812-odataservice-missing-quiet-patch-delete:
  // odataPostQuiet은 이미 있는데 PATCH/DELETE에는 quiet 짝이 없어, 자식 컬렉션을
  // 편집하고 부모의 파생 필드를 동기화하는 한 사용자 액션이 토스트 두 번을 내는
  // 문제를 피할 방법이 raw fetch() 우회뿐이었다.
  it('odataPatchQuiet does not toast on success', async () => {
    const success = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { success } })
    enqueue(new Response(null, { status: 204 }))
    await svc.odataPatchQuiet('Orders', '7', { name: 'b' })
    expect(success).not.toHaveBeenCalled()
    expect(recorded[0].url).toBe(`${BASE}/$data/Orders(7)`)
  })

  it('odataDeleteQuiet does not toast on success', async () => {
    const success = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { success } })
    enqueue(new Response(null, { status: 204 }))
    await svc.odataDeleteQuiet('Orders', '7')
    expect(success).not.toHaveBeenCalled()
    expect(recorded[0].url).toBe(`${BASE}/$data/Orders(7)`)
  })

  it('odataPatchQuiet normalizes empty strings to null, same as odataPatch', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(new Response(null, { status: 204 }))
    await svc.odataPatchQuiet('Orders', '7', { name: 'b', note: '' })
    expect(JSON.parse(recorded[0].body!)).toEqual({ name: 'b', note: null })
  })
})

describe('createODataService — errors', () => {
  it('non-401 error fires error toast and throws ApiError with status', async () => {
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })
    enqueue(json({ error: { message: '중복된 이름' } }, 409))
    await expect(svc.odataPost('Orders', { name: 'a' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      message: '중복된 이름',
    })
    expect(error).toHaveBeenCalledWith('중복된 이름')
  })

  it('OData v4 오류 봉투의 error.details(필드별 검증 상세)를 ApiError.details로 그대로 실어 던진다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(
      json(
        {
          error: {
            code: '',
            message: 'Name: The 역할 코드 field is required.',
            details: [{ code: '', message: 'The 역할 코드 field is required.', target: 'Name' }],
          },
        },
        400,
      ),
    )
    await expect(svc.odataPost('Orders', { name: '' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      details: [{ code: '', message: 'The 역할 코드 field is required.', target: 'Name' }],
    })
  })

  it('규격상 선택 항목인 target이 없어도 detail을 그대로 싣는다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(
      json(
        { error: { code: 'ValidationError', message: 'bad', details: [{ code: 'ValidationError', message: 'required' }] } },
        400,
      ),
    )
    await expect(svc.odataPost('Orders', {})).rejects.toMatchObject({
      details: [{ code: 'ValidationError', message: 'required' }],
    })
  })

  it('규격이 요구하는 code/message가 없는 항목은 걸러내고, 남는 항목이 없으면 undefined다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(
      json(
        {
          error: {
            message: 'bad',
            details: [{ code: 'A', message: 'keep' }, { target: 'Name' }, null, 'nope', { code: 1, message: 2 }],
          },
        },
        400,
      ),
    )
    await expect(svc.odataPost('Orders', {})).rejects.toMatchObject({
      details: [{ code: 'A', message: 'keep' }],
    })

    enqueue(json({ error: { message: 'bad', details: [{ target: 'Name' }] } }, 400))
    await expect(svc.odataPost('Orders', {})).rejects.toMatchObject({ details: undefined })
  })

  it('details가 배열이 아니면 undefined다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ error: { message: 'bad', details: { code: 'A', message: 'not an array' } } }, 400))
    await expect(svc.odataPost('Orders', {})).rejects.toMatchObject({ details: undefined })
  })

  it('error.details가 없는 응답은 ApiError.details가 undefined다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ error: { message: '중복된 이름' } }, 409))
    await expect(svc.odataPost('Orders', { name: 'a' })).rejects.toMatchObject({
      name: 'ApiError',
      details: undefined,
    })
  })

  it('formatError 콜백이 검증된 details를 함께 받는다', async () => {
    const formatError = vi.fn(() => '입력값을 확인하세요')
    const svc = createODataService({ baseUrl: BASE, formatError })
    enqueue(
      json(
        {
          error: {
            message: 'Validation failed',
            details: [{ code: 'ValidationError', message: 'required', target: 'Name' }],
          },
        },
        400,
      ),
    )
    await expect(svc.odataPost('Orders', {})).rejects.toMatchObject({ message: '입력값을 확인하세요' })
    expect(formatError).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 400,
        rawMessage: 'Validation failed',
        details: [{ code: 'ValidationError', message: 'required', target: 'Name' }],
      }),
    )
  })

  it('details가 없으면 formatError의 info.details도 undefined다', async () => {
    const formatError = vi.fn(() => undefined)
    const svc = createODataService({ baseUrl: BASE, formatError })
    enqueue(json({ error: { message: '중복된 이름' } }, 409))
    await expect(svc.odataPost('Orders', { name: 'a' })).rejects.toMatchObject({ message: '중복된 이름' })
    expect(formatError).toHaveBeenCalledWith(expect.objectContaining({ details: undefined }))
  })

  it('401 calls onUnauthorized, throws sessionExpired, and does NOT fire an error toast', async () => {
    const onUnauthorized = vi.fn()
    const error = vi.fn()
    const svc = createODataService({
      baseUrl: BASE,
      onUnauthorized,
      notify: { error },
      messages: { sessionExpired: '세션이 만료되었습니다' },
    })
    enqueue(new Response(null, { status: 401 }))
    await expect(svc.odataPost('Orders', { name: 'a' })).rejects.toMatchObject({
      status: 401,
      message: '세션이 만료되었습니다',
    })
    expect(onUnauthorized).toHaveBeenCalledWith(401)
    expect(error).not.toHaveBeenCalled()
  })

  // odataPatch/odataDelete는 이전에 throwIfError를 쓰지 않고 401/에러 처리를 각자
  // 인라인으로 중복 구현하고 있었다 — quiet 짝을 추가하며 throwIfError 재사용으로
  // 리팩터(§D-33) 했으므로, 그 리팩터가 기존 동작(에러 토스트·401 처리)을 그대로
  // 보존하는지 PATCH/DELETE 각각으로 직접 확인한다(이전엔 POST로만 커버돼 있었다).
  it('odataPatch non-401 error fires error toast and throws ApiError with status', async () => {
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })
    enqueue(json({ error: { message: '중복된 이름' } }, 409))
    await expect(svc.odataPatch('Orders', '7', { name: 'a' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      message: '중복된 이름',
    })
    expect(error).toHaveBeenCalledWith('중복된 이름')
  })

  it('odataDelete 401 calls onUnauthorized, throws sessionExpired, and does NOT fire an error toast', async () => {
    const onUnauthorized = vi.fn()
    const error = vi.fn()
    const svc = createODataService({
      baseUrl: BASE,
      onUnauthorized,
      notify: { error },
      messages: { sessionExpired: '세션이 만료되었습니다' },
    })
    enqueue(new Response(null, { status: 401 }))
    await expect(svc.odataDelete('Orders', '7')).rejects.toMatchObject({
      status: 401,
      message: '세션이 만료되었습니다',
    })
    expect(onUnauthorized).toHaveBeenCalledWith(401)
    expect(error).not.toHaveBeenCalled()
  })

  it('odataPatchQuiet/odataDeleteQuiet propagate errors without notifying', async () => {
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })

    enqueue(json({ error: { message: '중복된 이름' } }, 409))
    await expect(svc.odataPatchQuiet('Orders', '7', { name: 'a' })).rejects.toMatchObject({
      status: 409,
    })
    expect(error).not.toHaveBeenCalled()

    enqueue(json({ error: { message: '삭제 불가' } }, 409))
    await expect(svc.odataDeleteQuiet('Orders', '7')).rejects.toMatchObject({
      status: 409,
    })
    expect(error).not.toHaveBeenCalled()
  })

  it('formatError override wins over raw message', async () => {
    const svc = createODataService({
      baseUrl: BASE,
      formatError: ({ status }) => (status === 400 ? '입력값을 확인하세요' : undefined),
    })
    enqueue(json({ error: { message: 'Validation failed for field X' } }, 400))
    await expect(svc.odataGetById('Orders', '1')).rejects.toMatchObject({
      status: 400,
      message: '입력값을 확인하세요',
    })
  })

  it('falls back to http[status] message when raw is too long', async () => {
    const svc = createODataService({
      baseUrl: BASE,
      messages: { http: { 500: '서버 오류가 발생했습니다' } },
    })
    enqueue(json({ error: { message: 'x'.repeat(300) } }, 500))
    await expect(svc.odataGetById('Orders', '1')).rejects.toMatchObject({
      status: 500,
      message: '서버 오류가 발생했습니다',
    })
  })
})

describe('createODataService — custom REST', () => {
  it('apiDelete tolerates 204 empty body (no JSON parse error)', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(new Response(null, { status: 204 }))
    await expect(svc.apiDelete('orders/7')).resolves.toBeUndefined()
    expect(recorded[0].method).toBe('DELETE')
    expect(recorded[0].url).toBe(`${BASE}/api/orders/7`)
  })

  it('apiGet passes through a query string on the path', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ ok: true }))
    await svc.apiGet('reports?year=2026')
    expect(recorded[0].url).toBe(`${BASE}/api/reports?year=2026`)
  })

  it('ApiError is re-exposed on the service instance and matches the module class', () => {
    const svc = createODataService({ baseUrl: BASE })
    expect(svc.ApiError).toBe(ApiError)
  })

  it('apiPut sends a PUT with a JSON-serialized body', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ id: 1 }))
    await svc.apiPut('orders/1', { status: 'shipped' })
    expect(recorded[0].method).toBe('PUT')
    expect(recorded[0].url).toBe(`${BASE}/api/orders/1`)
    expect(recorded[0].body).toBe(JSON.stringify({ status: 'shipped' }))
    expect(recorded[0].contentType).toContain('application/json')
  })

  // docket #108 — 요청 본문은 apiPut 부재와 함께 "FormData가 JSON으로 강제 직렬화될 것"이라는
  // 우려도 제기했다. 실측: @iyulab/http-client의 guessMimeType이 FormData에는 Content-Type을
  // 세팅하지 않고(브라우저가 멀티파트 boundary와 함께 자동 설정) JSON.stringify 분기도
  // Content-Type이 application/json일 때만 타므로, apiPost/apiPatch/apiPut 전부 FormData를
  // 이미 있는 그대로(직렬화 없이) 전달한다 — 별도 코드 추가가 필요 없었다.
  it.each(['apiPost', 'apiPut', 'apiPatch'] as const)(
    '%s passes a FormData body through untouched (no JSON.stringify, no forced Content-Type)',
    async (method) => {
      const svc = createODataService({ baseUrl: BASE })
      enqueue(json({ ok: true }))
      const form = new FormData()
      form.append('file', new Blob(['x']), 'x.txt')
      await svc[method]('uploads/1', form)
      expect(recorded[0].rawBody).toBe(form)
      expect(recorded[0].contentType).toBeNull()
    },
  )
})

// docket #359 — `notify.error` 가 `odata*` 쓰기에만 걸리고 `api*` 에는 걸리지 않아, 서버가 409 와
// 사유를 정확히 돌려줘도 화면에 **아무것도 뜨지 않았다**. 실측된 소비앱의 업무 쓰기 경로 12곳이
// 전부 `api*` 였다. ★축은 «odata ↔ api» 가 아니라 «쓰기 ↔ 읽기» 다 — 조회는 양쪽 다 침묵한다.
describe('createODataService — 실패 통지의 축은 «쓰기 ↔ 읽기»', () => {
  const writes = ['apiPost', 'apiPut', 'apiPatch', 'apiDelete'] as const
  const quiet = ['apiPostQuiet', 'apiPutQuiet', 'apiPatchQuiet', 'apiDeleteQuiet'] as const

  it.each(writes)('%s 는 실패를 통지하고 그대로 다시 던진다', async (method) => {
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })
    enqueue(json({ Message: '이미 승인된 지시입니다' }, 409))
    await expect(svc[method]('orders/1/approve', {})).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
    })
    expect(error).toHaveBeenCalledWith('이미 승인된 지시입니다')
  })

  it.each(writes)('%s 는 401 을 통지하지 않는다 — onUnauthorized 와 겹친다', async (method) => {
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })
    enqueue(json({ Message: 'nope' }, 401))
    await expect(svc[method]('orders/1/approve', {})).rejects.toMatchObject({ status: 401 })
    expect(error).not.toHaveBeenCalled()
  })

  it.each(quiet)('%s 는 통지하지 않는다 — 자기 래퍼를 둔 소비자의 이중 토스트 탈출구', async (method) => {
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })
    enqueue(json({ Message: '이미 승인된 지시입니다' }, 409))
    await expect(svc[method]('orders/1/approve', {})).rejects.toMatchObject({ status: 409 })
    expect(error).not.toHaveBeenCalled()
  })

  it.each(['apiPost', 'apiPut', 'apiPatch', 'apiDelete'] as const)(
    '%s 는 성공해도 토스트를 띄우지 않는다 — 임의 RPC 에 맞는 성공 문구를 지어낼 수 없다',
    async (method) => {
      const success = vi.fn()
      const svc = createODataService({ baseUrl: BASE, notify: { success } })
      enqueue(json({ ok: true }))
      await svc[method]('orders/1/approve', {})
      expect(success).not.toHaveBeenCalled()
    },
  )

  it('조회는 양쪽 다 침묵한다 — 목록마다 토스트가 뜨면 읽을 수 없다', async () => {
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })
    enqueue(json({ Message: 'boom' }, 500))
    await expect(svc.apiGet('orders')).rejects.toMatchObject({ status: 500 })
    enqueue(json({ error: { message: 'boom' } }, 500))
    await expect(svc.odataGet('Orders')).rejects.toMatchObject({ status: 500 })
    // fetchRaw 는 «던지지 않는» 것이 계약이라 여기서는 상태만 확인한다(아래 전용 describe 참조).
    enqueue(json({ Message: 'boom' }, 500))
    expect((await svc.fetchRaw(`${BASE}/x`)).status).toBe(500)
    expect(error).not.toHaveBeenCalled()
  })

  it('notify 를 주지 않으면 순수하다 — 통지 경로가 생겼다고 throw 가 바뀌지 않는다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ Message: 'boom' }, 409))
    await expect(svc.apiPost('orders/1/approve', {})).rejects.toMatchObject({ status: 409 })
  })
})

describe('ODataRequestOptions — 전역 401 정책의 호출 단위 예외', () => {
  it('기본값은 종전 그대로다 — 401 이 훅을 부르고 sessionExpired 로 단락한다', async () => {
    const onUnauthorized = vi.fn()
    const svc = createODataService({ baseUrl: BASE, onUnauthorized })
    enqueue(json({ error: { message: '아이디 또는 비밀번호가 올바르지 않습니다' } }, 401))
    await expect(svc.apiPostQuiet('auth/login', {})).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledWith(401)
  })

  it('onUnauthorized:false 면 훅을 부르지 않고 «서버가 준 메시지» 로 던진다 — 로그인 폼이 사유를 지어내지 않아도 된다', async () => {
    const onUnauthorized = vi.fn()
    const svc = createODataService({ baseUrl: BASE, onUnauthorized })
    enqueue(json({ error: { message: '아이디 또는 비밀번호가 올바르지 않습니다' } }, 401))
    await expect(
      svc.apiPostQuiet('auth/login', { id: 'u', pw: 'x' }, { onUnauthorized: false }),
    ).rejects.toMatchObject({ status: 401, message: '아이디 또는 비밀번호가 올바르지 않습니다' })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('401 이 아닌 상태에는 아무 영향이 없다 — 이 옵션은 401 축 하나만 끈다', async () => {
    const onUnauthorized = vi.fn()
    const svc = createODataService({ baseUrl: BASE, onUnauthorized })
    enqueue(json({ Message: 'boom' }, 500))
    await expect(svc.apiGet('orders', { onUnauthorized: false })).rejects.toMatchObject({ status: 500 })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('통지 래퍼를 지나는 non-quiet 경로에서도 옵션이 전달된다', async () => {
    const onUnauthorized = vi.fn()
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, onUnauthorized, notify: { error } })
    enqueue(json({ error: { message: '자격 증명 오류' } }, 401))
    await expect(
      svc.apiPost('auth/login', {}, { onUnauthorized: false }),
    ).rejects.toMatchObject({ status: 401, message: '자격 증명 오류' })
    expect(onUnauthorized).not.toHaveBeenCalled()
    // 401 은 여전히 토스트 대상이 아니다 — 이 옵션이 통지 축을 건드리지 않는다는 뜻이다.
    expect(error).not.toHaveBeenCalled()
  })

  it('odata 쓰기 경로에도 열려 있다 — 부분집합으로 두면 다음 소비자가 다른 메서드에서 같은 벽을 만난다', async () => {
    const onUnauthorized = vi.fn()
    const svc = createODataService({ baseUrl: BASE, onUnauthorized })
    enqueue(json({ error: { message: '권한 없음' } }, 401))
    await expect(
      svc.odataPatchQuiet('Orders', '1', { x: 1 } as never, { onUnauthorized: false }),
    ).rejects.toMatchObject({ status: 401, message: '권한 없음' })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
})

describe('fetchRaw — 「raw」 는 정책을 태우지 않는다는 뜻이다', () => {
  it('비-2xx 에도 던지지 않고 응답을 그대로 돌려준다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ Message: 'boom' }, 500))
    const res = await svc.fetchRaw(`${BASE}/x`)
    expect(res.status).toBe(500)
    expect(res.ok).toBe(false)
  })

  it('401 에도 onUnauthorized 를 부르지 않는다 — 연결 프로브가 「서버가 살아서 거절했다」를 「끊김」으로 세지 않게', async () => {
    const onUnauthorized = vi.fn()
    const svc = createODataService({ baseUrl: BASE, onUnauthorized })
    enqueue(json({ error: { message: 'unauthorized' } }, 401))
    const res = await svc.fetchRaw(`${BASE}/ping`)
    expect(res.status).toBe(401)
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('2xx 는 종전과 같다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ ok: true }))
    const res = await svc.fetchRaw(`${BASE}/x`)
    expect(res.ok).toBe(true)
    expect(await res.json()).toEqual({ ok: true })
  })
})

// docket #415 — «이 실패를 사용자에게 알렸는가» 는 `notifyingWrite` 안에서만 확정된다. 에러와 함께
// 이동해야 경계(전역 거부 핸들러·error boundary)가 서비스 없이 «알리지 않은 것만» 알릴 수 있다.
describe('ApiError.notified — 알렸다는 사실이 에러와 함께 간다', () => {
  const writes = [
    ['odataPost', (s: any) => s.odataPost('Orders', {})],
    ['odataPatch', (s: any) => s.odataPatch('Orders', 1, {})],
    ['odataDelete', (s: any) => s.odataDelete('Orders', 1)],
    ['apiPost', (s: any) => s.apiPost('orders/1/approve', {})],
    ['apiPut', (s: any) => s.apiPut('orders/1', {})],
    ['apiPatch', (s: any) => s.apiPatch('orders/1', {})],
    ['apiDelete', (s: any) => s.apiDelete('orders/1')],
  ] as const

  const rejection = async (p: Promise<unknown>) => {
    try { await p } catch (e) { return e }
    throw new Error('expected a rejection')
  }

  it.each(writes)('%s 실패를 알렸으면 notified 가 true 다', async (_name, call) => {
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })
    enqueue(json({ Message: '이미 승인된 지시입니다' }, 409))
    const e = await rejection(call(svc))
    expect(error).toHaveBeenCalledOnce()
    expect(e).toBeInstanceOf(ApiError)
    expect((e as ApiError).notified).toBe(true)
    expect(wasNotified(e)).toBe(true)
  })

  it('401 은 알리지 않으므로 false 다 — onUnauthorized 가 안내한다', async () => {
    const svc = createODataService({ baseUrl: BASE, notify: { error: vi.fn() } })
    enqueue(json({ Message: 'nope' }, 401))
    const e = await rejection(svc.apiPost('orders/1/approve', {}))
    expect((e as ApiError).notified).toBe(false)
  })

  it('읽기 실패는 false 다 — 경계가 알려야 한다', async () => {
    const svc = createODataService({ baseUrl: BASE, notify: { error: vi.fn() } })
    enqueue(json({ Message: 'boom' }, 500))
    expect(((await rejection(svc.apiGet('orders'))) as ApiError).notified).toBe(false)
    enqueue(json({ error: { message: 'boom' } }, 500))
    expect(((await rejection(svc.odataGet('Orders'))) as ApiError).notified).toBe(false)
  })

  it('Quiet 쓰기는 false 다', async () => {
    const svc = createODataService({ baseUrl: BASE, notify: { error: vi.fn() } })
    enqueue(json({ Message: 'boom' }, 409))
    expect(((await rejection(svc.apiPostQuiet('orders/1/approve', {}))) as ApiError).notified).toBe(false)
  })

  it('notify.error 가 없으면 false 다 — «통지 경로를 탔다» 가 아니라 «실제로 알렸다»', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ Message: 'boom' }, 409))
    expect(((await rejection(svc.apiPost('orders/1/approve', {}))) as ApiError).notified).toBe(false)
  })

  it('ApiError 가 아닌 실패(네트워크)도 알렸다면 wasNotified 가 true 다', async () => {
    const error = vi.fn()
    const svc = createODataService({ baseUrl: BASE, notify: { error } })
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')))
    const e = await rejection(svc.apiPost('orders/1/approve', {}))
    expect(e).not.toBeInstanceOf(ApiError)
    expect(error).toHaveBeenCalledWith('Failed to fetch')
    expect(wasNotified(e)).toBe(true)
  })

  it('직접 만든 ApiError 와 원시값은 false 다 — 소비자가 표식을 세울 수 없다', () => {
    const e = new ApiError('x', 500)
    expect(e.notified).toBe(false)
    expect(() => { (e as any).notified = true }).toThrow()
    expect(wasNotified('boom')).toBe(false)
    expect(wasNotified(undefined)).toBe(false)
  })
})

describe('서버 주도 페이징 — `@odata.nextLink` 를 버리지 않는다', () => {
  // http-client 는 쿼리를 다시 직렬화한다(`$` → `%24`) — 뜻은 같으므로 디코드해서 비교한다.
  const sent = (i: number) => decodeURIComponent(recorded[i].url)

  it('odataGet 은 nextLink 를 끝까지 따라가 전량을 모은다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ value: [{ id: 1 }, { id: 2 }], '@odata.nextLink': `${BASE}/$data/Orders?$skiptoken=2` }))
    enqueue(json({ value: [{ id: 3 }] }))
    const rows = await svc.odataGet<{ id: number }>('Orders')
    expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    expect([sent(0), sent(1)]).toEqual([`${BASE}/$data/Orders`, `${BASE}/$data/Orders?$skiptoken=2`])
  })

  it('nextLink 가 없으면 종전과 같다 — 요청 하나', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ value: [{ id: 1 }] }))
    expect(await svc.odataGet('Orders', { $top: '20' })).toEqual([{ id: 1 }])
    expect(recorded).toHaveLength(1)
  })

  it('상대 nextLink 는 요청 URL 기준으로 푼다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ value: [{ id: 1 }], '@odata.nextLink': 'Orders?$skiptoken=1' }))
    enqueue(json({ value: [{ id: 2 }] }))
    expect(await svc.odataGet('Orders')).toEqual([{ id: 1 }, { id: 2 }])
    expect(sent(1)).toBe(`${BASE}/$data/Orders?$skiptoken=1`)
  })

  it('🔴서비스 오리진 밖의 nextLink 는 따라가지 않고 던진다 — 잘린 목록을 전량처럼 돌려주지 않는다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ value: [{ id: 1 }], '@odata.nextLink': 'https://elsewhere.test/$data/Orders?$skiptoken=1' }))
    await expect(svc.odataGet('Orders')).rejects.toThrow(/outside the service origin/)
    expect(recorded).toHaveLength(1)
  })

  it('🔴이미 읽은 페이지로 되돌아오는 nextLink 는 무한히 돌지 않고 던진다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ value: [{ id: 1 }], '@odata.nextLink': `${BASE}/$data/Orders?$skiptoken=1` }))
    enqueue(json({ value: [{ id: 2 }], '@odata.nextLink': `${BASE}/$data/Orders?$skiptoken=1` }))
    await expect(svc.odataGet('Orders')).rejects.toThrow(/repeats an already-read page/)
    expect(recorded).toHaveLength(2)
  })

  it('다음 페이지의 실패는 전역 401 정책을 그대로 탄다', async () => {
    const onUnauthorized = vi.fn()
    const svc = createODataService({ baseUrl: BASE, onUnauthorized })
    enqueue(json({ value: [{ id: 1 }], '@odata.nextLink': `${BASE}/$data/Orders?$skiptoken=1` }))
    enqueue(json({}, 401))
    await expect(svc.odataGet('Orders')).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledWith(401)
  })

  it('odataGetPage 는 한 페이지와 nextLink·count 를 준다 — odataGetNextPage 로 이어 읽는다', async () => {
    const svc = createODataService({ baseUrl: BASE })
    enqueue(json({ value: [{ id: 1 }], '@odata.count': 2, '@odata.nextLink': `${BASE}/$data/Orders?$skiptoken=1` }))
    const first = await svc.odataGetPage<{ id: number }>('Orders', { $count: 'true' })
    expect(first).toEqual({ value: [{ id: 1 }], count: 2, nextLink: `${BASE}/$data/Orders?$skiptoken=1` })
    enqueue(json({ value: [{ id: 2 }] }))
    const second = await svc.odataGetNextPage<{ id: number }>(first.nextLink!)
    expect(second).toEqual({ value: [{ id: 2 }] })
    expect(sent(1)).toBe(`${BASE}/$data/Orders?$skiptoken=1`)
  })

  it('odataGetNextPage 도 오리진 밖 URL 을 거부한다(요청 전에)', async () => {
    const svc = createODataService({ baseUrl: BASE })
    await expect(svc.odataGetNextPage('https://elsewhere.test/x')).rejects.toThrow(/outside the service origin/)
    expect(recorded).toHaveLength(0)
  })
})
