import { OperationTypeNode, OperationDefinitionNode, parse } from 'graphql'
import { getCleanUrl } from 'node-request-interceptor/lib/utils/getCleanUrl'
import { match } from 'node-match-path'
import {
  RequestHandler,
  MockedRequest,
  AsyncResponseResolverReturnType,
} from './handlers/requestHandler'
import { MockedResponse, ResponseComposition } from './response'
import { set } from './context/set'
import { status } from './context/status'
import { delay } from './context/delay'
import { fetch } from './context/fetch'
import { data, DataContext } from './context/data'
import { errors } from './context/errors'
import { Mask } from './setupWorker/glossary'
import { resolveMask } from './utils/resolveMask'
import { resolveRelativeUrl } from './utils/resolveRelativeUrl'

/* Logging */
import { prepareRequest } from './utils/logger/prepareRequest'
import { prepareResponse } from './utils/logger/prepareResponse'
import { getTimestamp } from './utils/logger/getTimestamp'
import { getStatusCodeColor } from './utils/logger/getStatusCodeColor'
import { jsonParse } from './utils/jsonParse'

type GraphQLRequestHandlerSelector = RegExp | string

export type GraphQLMockedRequest<VariablesType = Record<string, any>> = Omit<
  MockedRequest,
  'body'
> & {
  body: (GraphQLRequestPayload<VariablesType> & Record<string, any>) | undefined
  variables: VariablesType
}

// GraphQL related context should contain utility functions
// useful for GraphQL. Functions like `xml()` bear no value
// in the GraphQL universe.
export interface GraphQLMockedContext<QueryType> {
  set: typeof set
  status: typeof status
  delay: typeof delay
  fetch: typeof fetch
  data: DataContext<QueryType>
  errors: typeof errors
}

export const graphqlContext: GraphQLMockedContext<any> = {
  set,
  status,
  delay,
  fetch,
  data,
  errors,
}

export type GraphQLResponseResolver<QueryType, VariablesType> = (
  req: GraphQLMockedRequest<VariablesType>,
  res: ResponseComposition,
  context: GraphQLMockedContext<QueryType>,
) => AsyncResponseResolverReturnType<MockedResponse>

export interface GraphQLRequestPayload<VariablesType> {
  query: string
  variables?: VariablesType
}

interface GraphQLRequestParsedResult<VariablesType> {
  operationType: OperationTypeNode
  operationName: string | undefined
  variables: VariablesType | undefined
}

interface ParsedQueryPayload {
  operationName: string | undefined
}

export function parseQuery(
  query: string,
  definitionOperation: OperationTypeNode = 'query',
): ParsedQueryPayload {
  const ast = parse(query)

  const operationDef = ast.definitions.find(
    (def) =>
      def.kind === 'OperationDefinition' &&
      def.operation === definitionOperation,
  ) as OperationDefinitionNode

  return {
    operationName: operationDef?.name?.value,
  }
}

const createGraphQLHandler = (mask: Mask, operationType: OperationTypeNode) => {
  return <QueryType, VariablesType = Record<string, any>>(
    expectedOperation: GraphQLRequestHandlerSelector,
    resolver: GraphQLResponseResolver<QueryType, VariablesType>,
  ): RequestHandler<
    GraphQLMockedRequest<VariablesType>,
    GraphQLMockedContext<QueryType>,
    GraphQLRequestParsedResult<VariablesType>
  > => {
    const resolvedMask = resolveMask(mask)
    const cleanMask =
      resolvedMask instanceof URL
        ? getCleanUrl(resolvedMask)
        : resolvedMask instanceof RegExp
        ? resolvedMask
        : resolveRelativeUrl(resolvedMask)
    return {
      resolver,

      parse(req) {
        // According to the GraphQL specification, a GraphQL request can be issued
        // using both "GET" and "POST" methods.
        switch (req.method) {
          case 'GET': {
            const query = req.url.searchParams.get('query')
            const variablesString = req.url.searchParams.get('variables') || ''

            if (!query) {
              return null
            }

            const variables = variablesString
              ? jsonParse<VariablesType>(variablesString)
              : ({} as VariablesType)
            const { operationName } = parseQuery(query, operationType)

            return {
              operationType,
              operationName,
              variables,
            }
          }

          case 'POST': {
            if (!req.body) {
              return null
            }

            const { query, variables } = req.body as GraphQLRequestPayload<
              VariablesType
            >
            const { operationName } = parseQuery(query, operationType)

            return {
              operationType,
              operationName,
              variables,
            }
          }

          default:
            return null
        }
      },

      getPublicRequest(req, parsed) {
        return {
          ...req,
          variables: parsed.variables || ({} as VariablesType),
        }
      },

      predicate(req, parsed) {
        if (!parsed || !parsed.operationName) {
          return false
        }

        const cleanUrl = getCleanUrl(req.url)
        const isMatchingOperation =
          expectedOperation instanceof RegExp
            ? expectedOperation.test(parsed.operationName)
            : expectedOperation === parsed.operationName

        const urlMatch = match(cleanMask, cleanUrl)

        return urlMatch.matches && isMatchingOperation
      },

      defineContext() {
        return graphqlContext
      },

      log(req, res, handler, parsed) {
        const { operationName } = parsed
        const loggedRequest = prepareRequest(req)
        const loggedResponse = prepareResponse(res)

        console.groupCollapsed(
          '[MSW] %s %s (%c%s%c)',
          getTimestamp(),
          operationName,
          `color:${getStatusCodeColor(res.status)}`,
          res.status,
          'color:inherit',
        )
        console.log('Request:', loggedRequest)
        console.log('Handler:', {
          operationType,
          operationName: expectedOperation,
          predicate: handler.predicate,
        })
        console.log('Response:', loggedResponse)
        console.groupEnd()
      },
    }
  }
}

export const graphql = {
  link: (mask: Mask) => {
    return {
      query: createGraphQLHandler(mask, 'query'),
      mutation: createGraphQLHandler(mask, 'mutation'),
    }
  },
  query: createGraphQLHandler('*', 'query'),
  mutation: createGraphQLHandler('*', 'mutation'),
}
