import * as path from 'path'
import { TestAPI, runBrowserWith } from '../support/runBrowserWith'
import { executeOperation } from './utils/executeOperation'

describe('GraphQL: Link', () => {
  let test: TestAPI

  beforeAll(async () => {
    test = await runBrowserWith(path.resolve(__dirname, 'link.mocks.ts'))
  })

  afterAll(() => {
    return test.cleanup()
  })

  it('should mock the query response to github', async () => {
    const res = await executeOperation({
      page: test.page,
      endpoint: 'https://api.github.com/graphql',
      payload: {
        query: `
          query GetUser {
            user {
              id
            }
          }
        `,
      },
    })
    const headers = res.headers()
    const body = await res.json()

    expect(res.status()).toEqual(200)
    expect(headers).toHaveProperty('content-type', 'application/json')
    expect(body).toEqual({
      data: {
        user: {
          id: 'abc-123',
        },
      },
    })
  })

  it('should mock the query response to stripe', async () => {
    const res = await executeOperation({
      page: test.page,
      endpoint: 'https://api.stripe/v3/gql',
      payload: {
        query: `
          mutation WithdrawFunds {
            balane
          }
        `,
      },
    })
    const headers = res.headers()
    const body = await res.json()

    expect(res.status()).toEqual(200)
    expect(headers).toHaveProperty('content-type', 'application/json')
    expect(body).toEqual({
      data: {
        balance: 0,
      },
    })
  })
})
