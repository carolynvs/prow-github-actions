import * as github from '@actions/github'
import * as core from '@actions/core'
import {Context} from '@actions/github/lib/context'

import {getCommandArgs} from '../utils/command'
import {labelIssue, cancelLabel} from '../utils/labeling'
import {assertAuthorizedByOwnersOrMembership} from '../utils/auth'
import {asEventWithComment, createComment} from '../utils/comments'

/**
 * /lgtm will add the lgtm label.
 * Note - this label is used to indicate automatic merging
 * if the user has configured a cron job to perform automatic merging
 *
 * @param context - the github actions event context
 */
export const lgtm = async (
  context: Context = github.context
): Promise<void> => {
  const token = core.getInput('github-token', {required: true})
  const octokit = new github.GitHub(token)

  // Get a common representation of the triggering event
  const commentEvent = asEventWithComment(context)

  try {
    await assertAuthorizedByOwnersOrMembership(
      octokit,
      context,
      'reviewers',
      commentEvent.comment.user.login
    )
  } catch (e) {
    const msg = `Cannot apply the lgtm label because ${e}`

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
  const commentArgs: string[] = getCommandArgs('/lgtm', commentBody)

  // check if canceling last review
  if (commentArgs.length !== 0 && commentArgs[0] === 'cancel') {
    try {
      await cancelLabel(octokit, context, commentEvent.parent.number, 'lgtm')
    } catch (e) {
      throw new Error(`could not remove latest review: ${e}`)
    }
    return
  }

  labelIssue(octokit, context, commentEvent.parent.number, ['lgtm'])
}
