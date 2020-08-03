import { setupWorker, graphql } from 'msw'

const gitHub = graphql.link('https://api.github.com/graphql')
const stripe = graphql.link(/.+?.stripe\/v3\/gql/)

const worker = setupWorker(
  gitHub.query('GetUser', (req, res, ctx) => {
    return res(
      ctx.data({
        user: {
          id: 'abc-123',
        },
      }),
    )
  }),
  stripe.mutation('WithdrawFunds', (req, res, ctx) => {
    return res(
      ctx.data({
        balance: 0,
      }),
    )
  }),
)

worker.start()
