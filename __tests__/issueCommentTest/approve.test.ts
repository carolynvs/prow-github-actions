import nock from 'nock'

import {handleIssueComment} from '../../src/issueComment/handleIssueComment'
import { handleReview } from '../../src/issueComment/handleReview'

import * as utils from '../testUtils'

import pullReqListReviews from '../fixtures/pullReq/pullReqListReviews.json'
import issueCommentEvent from '../fixtures/issues/issueCommentEvent.json'
import reviewEvent from '../fixtures/pullReq/pullReqReviewEvent.json'

import { Context } from '@actions/github/lib/context'
import { WebhookPayload } from '@actions/github/lib/interfaces'

nock.disableNetConnect()

// Run the test suite for both the issue_comment and pull_request_review events
type ActionHandler = (context: Context) => Promise<void>;
type SetCommentHandler = (payload: any, body: string) => void;
const getLGTMTestCases = (): Array<[string,WebhookPayload,SetCommentHandler,ActionHandler]> => {
  return [
    ['issue_comment', issueCommentEvent, (payload, body) => {payload.comment.body = body}, handleIssueComment],
    ['pull_request_review', reviewEvent, (payload, body) => {payload.review.body = body}, handleReview],
  ]
}

describe.each(getLGTMTestCases())("event: %s", (eventName, payload, setComment, eventHandler)=>{
  beforeEach(() => {
    nock.cleanAll()
    utils.setupActionsEnv('/approve')
  })
  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(
        `Not all nock interceptors were used: ${JSON.stringify(
          nock.pendingMocks()
        )}`
      )
    }
  })

  it('fails if commenter is not an approver in OWNERS', async () => {
    const owners = Buffer.from(
      `
reviewers:
- Codertocat
    `
    ).toString('base64')

    const contentResponse = {
      type: 'file',
      encoding: 'base64',
      size: 4096,
      name: 'OWNERS',
      path: 'OWNERS',
      content: owners
    }

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/contents/OWNERS')
      .reply(200, contentResponse)

    const wantErr = `Codertocat is not included in the approvers role in the OWNERS file`

    // Mock the reply that the user is not authorized
    nock(utils.api)
      .post('/repos/Codertocat/Hello-World/issues/1/comments', (req) => {
        expect(req.body).toContain(wantErr)
        return true
      })
      .reply(200)

    setComment(payload, '/approve')
    const commentContext = new utils.mockContext(payload, eventName)

    await eventHandler(commentContext)
  })

  it('fails if commenter is not an org member or collaborator', async () => {
    const wantErr = `Codertocat is not a org member or collaborator`

    // Mock the reply that the user is not authorized
    nock(utils.api)
      .post('/repos/Codertocat/Hello-World/issues/1/comments', (req) => {
        expect(req.body).toContain(wantErr)
        return true
      })
      .reply(200)

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/contents/OWNERS')
      .reply(404)

    setComment(payload, '/approve')
    const commentContext = new utils.mockContext(payload, eventName)

    await eventHandler(commentContext)
  })

  it('approves if commenter is an approver in OWNERS', async () => {
    const owners = Buffer.from(
      `
approvers:
- Codertocat
    `
    ).toString('base64')

    const contentResponse = {
      type: 'file',
      encoding: 'base64',
      size: 4096,
      name: 'OWNERS',
      path: 'OWNERS',
      content: owners
    }
    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/contents/OWNERS')
      .reply(200, contentResponse)

    nock(utils.api)
      .post('/repos/Codertocat/Hello-World/pulls/1/reviews', body => {
        expect(body).toMatchObject({
          event: 'APPROVE'
        })
        return true
      })
      .reply(200)

    setComment(payload, '/approve')
    const commentContext = new utils.mockContext(payload, eventName)

    await eventHandler(commentContext)
  })

  it('approves if commenter is an org member', async () => {
    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/contents/OWNERS')
      .reply(404)

    nock(utils.api).get('/orgs/Codertocat/members/Codertocat').reply(204)

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/collaborators/Codertocat')
      .reply(404)

    nock(utils.api)
      .post('/repos/Codertocat/Hello-World/pulls/1/reviews', body => {
        expect(body).toMatchObject({
          event: 'APPROVE'
        })
        return true
      })
      .reply(200)

    setComment(payload, '/approve')
    const commentContext = new utils.mockContext(payload, eventName)

    await eventHandler(commentContext)
  })

  it('removes approval with the /approve cancel command if approver in OWNERS file', async () => {
    const owners = Buffer.from(
      `
approvers:
- Codertocat
`
    ).toString('base64')

    const contentResponse = {
      type: 'file',
      encoding: 'base64',
      size: 4096,
      name: 'OWNERS',
      path: 'OWNERS',
      content: owners
    }
    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/contents/OWNERS')
      .reply(200, contentResponse)

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/pulls/1/reviews')
      .reply(200, pullReqListReviews)

    nock(utils.api)
      .put(
        '/repos/Codertocat/Hello-World/pulls/1/reviews/80/dismissals',
        body => {
          expect(body).toMatchObject({
            message: `Canceled through prow-github-actions by @Codertocat`
          })
          return true
        }
      )
      .reply(200)

    setComment(payload, '/approve cancel')
    const commentContext = new utils.mockContext(payload, eventName)

    await eventHandler(commentContext)
  })

  it('removes approval with the /approve cancel command if commenter is collaborator', async () => {
    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/contents/OWNERS')
      .reply(404)

    nock(utils.api).get('/orgs/Codertocat/members/Codertocat').reply(404)

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/collaborators/Codertocat')
      .reply(204)

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/pulls/1/reviews')
      .reply(200, pullReqListReviews)

    nock(utils.api)
      .put(
        '/repos/Codertocat/Hello-World/pulls/1/reviews/80/dismissals',
        body => {
          expect(body).toMatchObject({
            message: `Canceled through prow-github-actions by @Codertocat`
          })
          return true
        }
      )
      .reply(200)

    setComment(payload, '/approve cancel')
    const commentContext = new utils.mockContext(payload, eventName)

    await eventHandler(commentContext)
  })
})
