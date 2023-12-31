import { Hono } from 'hono'
import { expect, test } from 'vitest'
import {
  USE_MIDDLEWARE,
  cookieSignature,
  useCookieSignatureMiddleware,
} from '../src/middleware'
import { getVerifiedCookie } from '../src/functions'

test('useCookieSignatureMiddleware', async () => {
  const app = new Hono()

  app
    .get('/use-middleware', async (context) => {
      // @ts-expect-error
      context.set(USE_MIDDLEWARE, true)

      expect(useCookieSignatureMiddleware(context)).toBeTruthy()
    })
    .get('/not-use-middleware', async (context) => {
      expect(useCookieSignatureMiddleware(context)).toBeFalsy()
    })

  await app.request('/use-middleware')
  await app.request('/not-use-middleware')
})

test('cookieSignature', async () => {
  const secret = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('THIS_IS_SECRET_KEY'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  const app = new Hono()

  app.get(
    '/cookie',
    cookieSignature({
      cookies: ['bassfreq', 'caz'],
      secret,
    }),
    async (context) => {
      expect(getVerifiedCookie(context, 'bassfreq')).toBe('Rawstyle')
      expect(getVerifiedCookie(context, 'caz')).toBe('MEGATON KICK')
      expect(getVerifiedCookie(context, 'mahiro')).toBeUndefined()
      // @ts-expect-error
      expect(context.get(USE_MIDDLEWARE)).toBeTruthy()

      return context.text('ok')
    }
  )

  {
    // cookiesで設定されたキーのペアが存在しない場合はHTTP 400を返すこと
    const response = await app.request('/cookie')

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchSnapshot()
  }

  {
    // cookiesで設定されたキーがCookieに存在するものの、フォーマットが不正な場合はHTTP 400を返すこと
    const response = await app.request('/cookie', {
      headers: {
        cookie: 'bassfreq=rawstyle; caz=BCM',
      },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchSnapshot()
  }

  {
    const response = await app.request('/cookie', {
      headers: {
        cookie: [
          'bassfreq=UmF3c3R5bGU.W57skKFxTQuP6er86djSk2cL9iP3h9W-FzePE6auus4',
          'caz=TUVHQVRPTiBLSUNL.k203sS2F7OLETAI9bQgTm8Md0J1yw_VMndVwzjrAxfE',
        ].join('; '),
      },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchSnapshot()
  }

  {
    // Cookieに設定されている値と署名が正しい場合はHTTP 200を返す
    const response = await app.request('/cookie', {
      headers: {
        cookie: [
          'bassfreq=UmF3c3R5bGU.W57skKFxTQuP6er86djSk2cL9iP3h9W-FzePE6auus4',
          'caz=TUVHQVRPTiBLSUNL.zAcaV3FbkrXArqSUjuAAJJIoyvZxLXP6N7EpG0wkL1g',
        ].join('; '),
      },
    })

    expect(response.status).toBe(200)
  }
})
