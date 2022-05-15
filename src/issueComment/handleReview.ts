import * as core from '@actions/core'
import * as github from '@actions/github'

import {Context} from '@actions/github/lib/context'
import {approve} from './approve'
import {lgtm} from '../labels/lgtm'

/**
 * This Method handles any pull request reviews
 * A user should define which of the commands they want to run in their workflow yaml
 *
 * @param context - the github context of the current action event
 */
export const handleReview = async (
  context: Context = github.context
): Promise<void> => {
  const commandConfig = core
    .getInput('prow-commands', {required: false})
    .replace(/\n/g, ' ')
    .split(' ')
  const commentBody: string = context.payload['review']['body']

  await Promise.all(
    commandConfig.map(async command => {
      if (commentBody.includes(command)) {
        switch (command) {
          case '/approve':
            return await approve(context).catch(async e => {
              return e
            })

          case '/lgtm':
            return await lgtm(context).catch(async e => {
              return e
            })

          case '':
            return new Error(
              `please provide a list of space delimited commands / jobs to run. None found`
            )

          default:
            return new Error(
              `could not execute ${command}. May not be supported - please refer to docs`
            )
        }
      }
    })
  )
    .then(results => {
      for (const result of results) {
        if (result instanceof Error) {
          throw new Error(`error handling review: ${result}`)
        }
      }
    })
    .catch(e => {
      core.setFailed(`${e}`)
    })
}
