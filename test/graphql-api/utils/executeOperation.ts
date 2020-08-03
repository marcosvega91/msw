import { Page } from 'puppeteer'

export const HOSTNAME = 'http://localhost:8080/graphql'

/**
 * Standalone GraphQL operations dispatcher.
 */
export const graphqlOperation = (url: string) => {
  return (query: string) => {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
      }),
    })
  }
}

interface GraphQLRequestPayload {
  query: string
  variables?: Record<string, string>
}

type ExecuteOperationProps = {
  page: Page
  endpoint?: string
  payload: GraphQLRequestPayload
  method?: 'GET' | 'POST'
}

/**
 * Executes a GraphQL operation in the given Puppeteer context.
 */
export const executeOperation = async ({
  page,
  endpoint = HOSTNAME,
  payload,
  method = 'POST',
}: ExecuteOperationProps) => {
  const { query, variables } = payload

  const url = new URL(endpoint)

  if (method === 'GET') {
    url.searchParams.set('query', query)

    if (variables) {
      url.searchParams.set('variables', JSON.stringify(variables))
    }
  }

  const urlString = url.toString()
  page.evaluate(
    (url, method, query, variables) => {
      fetch(
        url,
        Object.assign(
          {},
          method === 'POST' && {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query,
              variables,
            }),
          },
        ),
      )
    },
    urlString,
    method,
    payload.query,
    payload.variables,
  )

  return page.waitForResponse(urlString)
}
