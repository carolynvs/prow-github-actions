import {Context} from '@actions/github/lib/context'
import {WebhookPayload} from '@actions/github/lib/interfaces'

export const api = 'https://api.github.com'

// Generate and create a fake context to use
export const mockContext = class extends Context {
  constructor(payload: WebhookPayload, eventName: string = '') {
    super()
    this.payload = payload
    this.eventName = eventName
  }
}

/** Create a mocked IssueCommentEvent from the specified payload */
export const mockIssueComment = (payload: WebhookPayload): Context => {
  return new mockContext(payload, 'issue_comment')
}

/** Create a mocked PullRequestReviewEvent from the specified payload */
export const mockReview = (payload: WebhookPayload): Context => {
  return new mockContext(payload, 'pull_request_review')
}

export const setupActionsEnv = (command: string = '') => {
  process.env = {}

  // set the neccessary env variables expected by the action:
  // https://help.github.com/en/github/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#jobsjob_idstepswith
  process.env['INPUT_PROW-COMMANDS'] = command
  process.env['INPUT_GITHUB-TOKEN'] = 'some-token'
}

export const setupJobsEnv = (arg: string = '') => {
  process.env = {}

  // set the neccessary env variables expected by the action:
  // https://help.github.com/en/github/automating-your-workflow-with-github-actions/workflow-syntax-for-github-actions#jobsjob_idstepswith
  process.env['INPUT_JOBS'] = arg
  process.env['INPUT_GITHUB-TOKEN'] = 'some-token'
}
