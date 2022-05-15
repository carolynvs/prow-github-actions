import * as github from '@actions/github'
import {Context} from '@actions/github/lib/context'
import {
  IssueCommentEvent,
  PullRequestReviewEvent,
  User
} from '@octokit/webhooks-definitions/schema'

/**
 * createComment comments on the specified issue or pull request
 *
 * @param octokit - a hydrated github client
 * @param context - the github actions event context
 * @param issueNum - the issue associated with this runtime
 * @param message - the comment message body
 */
export const createComment = async (
  octokit: github.GitHub,
  context: Context,
  issueNum: number,
  message: string
): Promise<void> => {
  try {
    await octokit.issues.createComment({
      ...context.repo,
      issue_number: issueNum,
      body: message
    })
  } catch (e) {
    throw new Error(`could not add comment: ${e}`)
  }
}

/**
 * asEventWithComment identifies the type of event and returns an EventWithComment
 * containing the comment associated with the event.
 * @param context - the github actions event context
 */
export const asEventWithComment = (
  context: Context = github.context
): EventWithComment => {
  switch (context.eventName) {
    case 'issue_comment': {
      const commentEvt = context.payload as IssueCommentEvent
      if (commentEvt === undefined) {
        throw new Error(
          `github context eventName is issue_comment but the payload is not an IssueCommentEvent`
        )
      }
      return {
        comment: commentEvt.comment,
        parent: commentEvt.issue
      }
    }
    case 'pull_request_review': {
      const reviewEvt = context.payload as PullRequestReviewEvent
      if (reviewEvt === undefined) {
        throw new Error(
          `github context eventName is pull_request_review but the payload is not an PullRequestReviewEvent`
        )
      }
      return {
        comment: reviewEvt.review,
        parent: reviewEvt.pull_request
      }
    }
    case '': {
      throw new Error(`github context does not have an eventName set`)
    }
    default: {
      throw new Error(
        `github context payload did not contain an issue or pull request for event: ${context.eventName}`
      )
    }
  }
}

/** EventWithComment represents a GitHub event that has an associated comment,
 * such as IssueCommentEvent or PullRequestReviewEvent.
 */
export interface EventWithComment {
  /** The GitHub object that contains the comment, such as a PullRequestReview, or IssueComment. */
  comment: Comment

  /** The parent object associated with the event, such as the PullRequest or Issue. */
  parent: WebhookPayloadObject
}

/** Comment represents a GitHub object that has a comment associated with it. */
export interface Comment {
  /** The body of the comment */
  body: string | null
  /** The user who posted the comment */
  user: User
}

/**
 * WebhookPayloadObject represents the comment set of fields
 * available on a WebhookPayload Issue or PullRequest.
 */
export interface WebhookPayloadObject {
  /** The issue or pull request number. */
  number: number
}
