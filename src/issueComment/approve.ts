import * as github from '@actions/github'
import * as core from '@actions/core'

import {Octokit} from '@octokit/rest'
import {Context} from '@actions/github/lib/context'
import {getCommandArgs} from '../utils/command'
import {assertAuthorizedByOwnersOrMembership} from '../utils/auth'
import {asEventWithComment, createComment} from '../utils/comments'

/**
 * the /approve command will create a "approve" review
 * from the github-actions bot
 *
 * If the argument 'cancel' is provided to the /approve command
 * the last review will be removed
 *
 * @param context - the github actions event context
 */
export const approve = async (
  context: Context = github.context
): Promise<void> => {
  core.debug(`starting approve job`)

  const token = core.getInput('github-token', {required: true})
  const octokit = new github.GitHub(token)

  // Get a common representation of the triggering event
  const commentEvent = asEventWithComment(context)

  try {
    await assertAuthorizedByOwnersOrMembership(
      octokit,
      context,
      'approvers',
      commentEvent.comment.user.login
    )
  } catch (e) {
    const msg = `Cannot approve the pull request: ${e}`

    // Try to reply back that the user is unauthorized
    try {
      createComment(octokit, context, commentEvent.parent.number, msg)
    } catch (commentE) {
      // Log the comment error but continue to throw the original auth error
      core.error(`Could not comment with an auth error: ${commentE}`)
    }
    throw e
  }

  const commentBody = commentEvent.comment.body || ''
  const commentArgs: string[] = getCommandArgs('/approve', commentBody)

  // check if canceling last review
  if (commentArgs.length !== 0 && commentArgs[0] === 'cancel') {
    try {
      await cancel(
        octokit,
        context,
        commentEvent.parent.number,
        commentEvent.comment.user.login
      )
    } catch (e) {
      throw new Error(`could not remove latest review: ${e}`)
    }
    return
  }

  try {
    core.debug(`creating a review`)
    await octokit.pulls.createReview({
      ...context.repo,
      pull_number: commentEvent.parent.number,
      event: 'APPROVE',
      comments: []
    })
  } catch (e) {
    throw new Error(`could not create review: ${e}`)
  }
}

/**
 * Removes the latest review from the github actions bot
 *
 * @param octokit - a hydrated github api client
 * @param context - the github actions workflow event context
 * @param issueNumber - the PR to remove the review
 * @param commenterLogin - the login name of the user who made comment
 */
const cancel = async (
  octokit: github.GitHub,
  context: Context,
  issueNumber: number,
  commenterLogin: string
): Promise<void> => {
  core.debug(`canceling latest review`)

  let reviews: Octokit.Response<Octokit.PullsListReviewsResponse>
  try {
    reviews = await octokit.pulls.listReviews({
      ...context.repo,
      pull_number: issueNumber
    })
  } catch (e) {
    throw new Error(`could not list reviews for PR ${issueNumber}: ${e}`)
  }

  let latestReview = undefined
  for (const e of reviews.data) {
    core.debug(`checking review: ${e.user.login}`)
    if (e.user.login === 'github-actions[bot]' && e.state === 'APPROVED') {
      latestReview = e
    }
  }

  if (latestReview === undefined) {
    throw new Error('no latest review found to cancel')
  }

  try {
    await octokit.pulls.dismissReview({
      ...context.repo,
      pull_number: issueNumber,
      review_id: latestReview.id,
      message: `Canceled through prow-github-actions by @${commenterLogin}`
    })
  } catch (e) {
    throw new Error(`could not dismiss review: ${e}`)
  }
}
