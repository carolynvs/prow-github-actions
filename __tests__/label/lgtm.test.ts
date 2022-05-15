import nock from 'nock'

import {Context} from '@actions/github/lib/context'
import {handleIssueComment} from '../../src/issueComment/handleIssueComment'
import {handleReview} from '../../src/issueComment/handleReview'

import * as utils from '../testUtils'

import issueCommentEvent from '../fixtures/issues/issueCommentEvent.json'
import reviewEvent from '../fixtures/pullReq/pullReqReviewEvent.json'
import issuePayload from '../fixtures/issues/issue.json'
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
    utils.setupActionsEnv('/lgtm')
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

  it('labels the issue with the lgtm label', async () => {
    setComment(payload, '/lgtm')
    const commentContext = new utils.mockContext(payload, eventName)

    let parsedBody = undefined
    const scope = nock(utils.api)
      .post('/repos/Codertocat/Hello-World/issues/1/labels', body => {
        parsedBody = body
        return body
      })
      .reply(200)

    nock(utils.api).get('/orgs/Codertocat/members/Codertocat').reply(204)

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/collaborators/Codertocat')
      .reply(404)

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/contents/OWNERS')
      .reply(404)

    await eventHandler(commentContext)
    expect(parsedBody).toEqual({
      labels: ['lgtm']
    })
  })

  it('removes the lgtm label with /lgtm cancel', async () => {
    setComment(payload, '/lgtm cancel')
    const commentContext = new utils.mockContext(payload, eventName)

    issuePayload.labels.push({
      id: 1,
      node_id: '123',
      url: 'https://api.github.com/repos/octocat/Hello-World/labels/lgtm',
      name: 'lgtm',
      description: 'looks good to me',
      color: 'f29513',
      default: true
    })

    nock(utils.api)
      .delete('/repos/Codertocat/Hello-World/issues/1/labels/lgtm')
      .reply(200)

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/issues/1')
      .reply(200, issuePayload)

    nock(utils.api).get('/orgs/Codertocat/members/Codertocat').reply(204)

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/collaborators/Codertocat')
      .reply(404)

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/contents/OWNERS')
      .reply(404)

    await eventHandler(commentContext)
  })

  it('adds label if commenter is collaborator', async () => {
    setComment(payload, '/lgtm')
    const commentContext = new utils.mockContext(payload, eventName)

    let parsedBody = undefined
    const scope = nock(utils.api)
      .post('/repos/Codertocat/Hello-World/issues/1/labels', body => {
        parsedBody = body
        return body
      })
      .reply(200)

    nock(utils.api).get('/orgs/Codertocat/members/Codertocat').reply(404)

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/collaborators/Codertocat')
      .reply(204)

    nock(utils.api)
      .get('/repos/Codertocat/Hello-World/contents/OWNERS')
      .reply(404)

    await eventHandler(commentContext)
    expect(parsedBody).toEqual({
      labels: ['lgtm']
    })
  })

  it('fails if commenter is not reviewer in OWNERS', async () => {
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

    const wantErr = `Codertocat is not included in the reviewers role in the OWNERS file`

    // Mock the reply that the user is not authorized
    nock(utils.api)
      .post('/repos/Codertocat/Hello-World/issues/1/comments', (req) => {
        expect(req.body).toContain(wantErr)
        return true
      })
      .reply(200)

    setComment(payload, '/lgtm')
    const commentContext = new utils.mockContext(payload, eventName)

    await eventHandler(commentContext)
  })

  it('fails if commenter is not org member or collaborator', async () => {
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

    setComment(payload, '/lgtm')
    const commentContext = new utils.mockContext(payload, eventName)

    await eventHandler(commentContext)
  })

  it('adds label if commenter is reviewer in OWNERS', async () => {
    issueCommentEvent.comment.body = '/lgtm'
    const commentContext = new utils.mockContext(payload, eventName)

    let parsedBody = undefined
    const scope = nock(utils.api)
      .post('/repos/Codertocat/Hello-World/issues/1/labels', body => {
        parsedBody = body
        return body
      })
      .reply(200)

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

    await eventHandler(commentContext)
    expect(parsedBody).toEqual({
      labels: ['lgtm']
    })
  })
})
