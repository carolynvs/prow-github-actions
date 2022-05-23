import * as core from '@actions/core'
import * as github from '@actions/github'
import {handleIssueComment} from './issueComment/handleIssueComment'
import {handlePullReq} from './pullReq/handlePullReq'
import {handleCronJobs} from './cronJobs/handleCronJob'
import {handleReview} from './issueComment/handleReview'

async function run(): Promise<void> {
  try {
    switch (github.context.eventName) {
      case 'issue_comment':
        handleIssueComment()
        break

      case 'pull_request':
        handlePullReq()
        break

      case 'workflow_run':
        handleReview()
        break

      case 'schedule':
        handleCronJobs()
        break

      default:
        core.error(`${github.context.eventName} not yet supported`)
        break
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
